"""
Logic nghiệp vụ cho các tính năng mở rộng.

Mọi hàm ở đây thuần Python/ORM, không phụ thuộc request, để dùng chung cho API,
management command và Celery task.
"""
import hashlib
import io
import logging
import re
import unicodedata
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max
from django.utils import timezone

logger = logging.getLogger(__name__)

# ==============================================================================
# Chuẩn hóa văn bản tiếng Việt
# ==============================================================================

_WORD_RE = re.compile(r"[a-z0-9]+")


def normalize_vi(text):
    """Bỏ dấu, chữ thường, chỉ giữ chữ/số: 'Hệ thống Quản lý' -> 'he thong quan ly'."""
    if not text:
        return ""
    text = str(text).replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(_WORD_RE.findall(text.lower()))


# Từ chức năng và động từ chung chung, xuất hiện ở hầu hết tên đề tài nên không mang thông tin.
# "quan", "ly" (quản lý – management) added because virtually every CS thesis contains this phrase;
# keeping them would inflate similarity between "quản lý X" vs "quản lý Y" titles that differ in X/Y.
TOPIC_STOPWORDS = {
    "va", "cua", "cho", "tai", "trong", "voi", "cac", "nhung", "mot", "la", "de", "theo", "tren", "bang", "ve",
    "xay", "dung", "thiet", "ke", "nghien", "cuu", "phat", "trien", "ung", "trien", "khai", "su", "dung",
    "tim", "hieu", "va", "hoa", "giai", "phap", "he", "thong", "the", "a", "an", "of", "for", "and", "the",
    "to", "in", "on", "using", "based", "system", "design", "development", "building", "web", "app",
    # Management / common verbs ubiquitous in Vietnamese CS thesis titles:
    "quan", "ly", "ung", "ap", "tao", "xay", "thuc", "hien", "noi",
}


def _content_tokens(text):
    return [t for t in normalize_vi(text).split() if t not in TOPIC_STOPWORDS and len(t) > 1]


def _char_trigrams(normalized_text):
    """Trigram counter on already-normalized (no-diacritics, lowercase) text.

    Caller is responsible for passing the text that reflects the desired comparison scope.
    Previously this function called normalize_vi() internally, which meant the full title
    including generic stop-words inflated cosine similarity between unrelated titles sharing
    a common prefix like 'xay dung he thong quan ly'. Now topic_similarity passes the
    content-token text so that stop-words are excluded before trigrams are computed.
    """
    s = f"  {normalized_text}  "
    return Counter(s[i:i + 3] for i in range(len(s) - 2))


def topic_similarity(a, b):
    """Độ tương đồng 0..1 giữa hai tên đề tài: max(Jaccard từ khóa, cosine trigram ký tự).

    Trigrams are now computed on content-token text (stop-words removed) to avoid false
    positives for titles that share a generic prefix such as 'Xây dựng hệ thống quản lý X'
    vs 'Xây dựng hệ thống quản lý Y' where X ≠ Y.

    Returns 0.0 when either title has no content tokens (all stop-words / empty).
    """
    ta, tb = set(_content_tokens(a)), set(_content_tokens(b))
    if not ta or not tb:
        return 0.0
    jaccard = len(ta & tb) / len(ta | tb)
    # Use content-token text for trigrams to suppress generic-word noise
    a_tok = " ".join(sorted(ta))
    b_tok = " ".join(sorted(tb))
    ca, cb = _char_trigrams(a_tok), _char_trigrams(b_tok)
    dot = sum(v * cb.get(k, 0) for k, v in ca.items())
    norm = (sum(v * v for v in ca.values()) ** 0.5) * (sum(v * v for v in cb.values()) ** 0.5)
    cosine = dot / norm if norm else 0.0
    return round(max(jaccard, cosine), 3)


def find_similar_topics(title, exclude_project_id=None, threshold=0.55, limit=10):
    """So khớp tên đề tài với mọi đồ án (mọi đợt) để phát hiện trùng lặp."""
    from .models import GraduationProject

    if not normalize_vi(title):
        return []
    qs = GraduationProject.objects.select_related("student__user", "supervisor__user", "batch").only(
        "id", "topic_title_vi", "topic_title_en", "status", "batch__batch_code", "batch__batch_name",
        "student__registration_no", "student__user__first_name", "student__user__last_name",
        "supervisor__user__first_name", "supervisor__user__last_name",
    )
    if exclude_project_id:
        qs = qs.exclude(id=exclude_project_id)

    matches = []
    for p in qs.iterator():
        score = max(topic_similarity(title, p.topic_title_vi or ""), topic_similarity(title, p.topic_title_en or ""))
        if score >= threshold:
            matches.append({
                "project_id": p.id,
                "topic_title_vi": p.topic_title_vi,
                "topic_title_en": p.topic_title_en or "",
                "batch_code": getattr(p.batch, "batch_code", ""),
                "status": p.status,
                "supervisor_name": p.supervisor.user.get_full_name() if p.supervisor_id else "",
                "similarity": score,
                "level": "HIGH" if score >= 0.75 else "MEDIUM",
            })
    matches.sort(key=lambda m: m["similarity"], reverse=True)
    return matches[:limit]


# ==============================================================================
# Trích xuất nội dung file và kiểm tra tương đồng (đạo văn nội bộ)
# ==============================================================================

MAX_EXTRACTED_CHARS = 400_000
# Maximum total uncompressed bytes allowed inside a DOCX/ZIP to prevent zip-bomb DoS.
# A normal 500-page DOCX word/document.xml rarely exceeds 20 MB; 50 MB is a generous cap.
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
SHINGLE_SIZE = 5
MIN_SHINGLES = 30


def extract_text(django_file, filename):
    """Trích văn bản từ PDF (cần pypdf), DOCX (stdlib) hoặc TXT/MD. Lỗi -> chuỗi rỗng.

    Security bounds:
    - PDF: at most 300 pages, output capped at MAX_EXTRACTED_CHARS.
    - DOCX: zip total uncompressed size checked against MAX_DOCX_UNCOMPRESSED_BYTES
      (zip-bomb guard) before any member is decompressed.
    - TXT/MD: input capped at MAX_EXTRACTED_CHARS bytes.
    """
    name = (filename or "").lower()
    try:
        django_file.seek(0)
        data = django_file.read()
    except Exception:
        return ""
    finally:
        try:
            django_file.seek(0)
        except Exception:
            pass

    try:
        if name.endswith(".pdf"):
            try:
                from pypdf import PdfReader
            except ImportError:
                logger.warning("pypdf chưa được cài, bỏ qua trích xuất PDF")
                return ""
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((page.extract_text() or "") for page in reader.pages[:300])
        elif name.endswith(".docx"):
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                # Zip-bomb guard – two layers:
                # 1. Total uncompressed size across all entries (catches multi-entry bombs).
                total_uncompressed = sum(info.file_size for info in zf.infolist())
                if total_uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES:
                    logger.warning(
                        "DOCX %s rejected: total uncompressed size %d bytes exceeds limit %d",
                        filename, total_uncompressed, MAX_DOCX_UNCOMPRESSED_BYTES,
                    )
                    return ""
                # 2. Per-entry size for the specific member we care about, plus compression-
                #    ratio check (legitimate docs rarely compress > 100:1; zip bombs can be
                #    1000:1 or more).  Also use stream-read with a hard byte cap so even a
                #    mis-reported file_size cannot allocate unbounded memory.
                try:
                    info = zf.getinfo("word/document.xml")
                except KeyError:
                    return ""  # malformed DOCX – no document body
                if info.file_size > MAX_DOCX_UNCOMPRESSED_BYTES:
                    logger.warning("DOCX %s: word/document.xml claims %d bytes – rejected", filename, info.file_size)
                    return ""
                if info.compress_size > 0 and (info.file_size / info.compress_size) > 100:
                    logger.warning(
                        "DOCX %s: suspicious compression ratio %d:1 – rejected",
                        filename, int(info.file_size / info.compress_size),
                    )
                    return ""
                # Stream-read with explicit byte cap (guards against mis-reported file_size).
                read_limit = min(info.file_size + 1024, MAX_DOCX_UNCOMPRESSED_BYTES)
                with zf.open("word/document.xml") as fh:
                    xml_bytes = fh.read(read_limit)
                xml = xml_bytes.decode("utf-8", errors="ignore")
            xml = re.sub(r"</w:p>", "\n", xml)
            text = re.sub(r"<[^>]+>", "", xml)
        elif name.endswith((".txt", ".md")):
            # Cap raw bytes before decoding to avoid huge allocation for exotic encodings.
            raw = data[:MAX_EXTRACTED_CHARS * 4]
            # Detect UTF-16 by BOM before trying other encodings; cp1258 would otherwise
            # successfully (but wrongly) decode UTF-16 BOM bytes as Vietnamese characters.
            utf16_boms = (b'\xff\xfe', b'\xfe\xff', b'\xff\xfe\x00\x00', b'\x00\x00\xfe\xff')
            if any(raw[:4].startswith(bom) if len(bom) == 4 else raw[:2] == bom for bom in utf16_boms):
                try:
                    text = raw.decode("utf-16")
                except (UnicodeDecodeError, ValueError):
                    text = raw.decode("utf-8", errors="ignore")
            else:
                # Try UTF-8, then cp1258 (Vietnamese Windows encoding), then latin-1 fallback.
                for enc in ("utf-8", "cp1258", "latin-1"):
                    try:
                        text = raw.decode(enc)
                        break
                    except (UnicodeDecodeError, ValueError):
                        continue
                else:
                    text = raw.decode("utf-8", errors="ignore")
        else:
            return ""
    except Exception as exc:
        logger.info("Không trích xuất được nội dung %s: %s", filename, exc)
        return ""
    return text[:MAX_EXTRACTED_CHARS]


def _shingles(text):
    words = normalize_vi(text).split()
    if len(words) < SHINGLE_SIZE:
        return set()
    return {
        hashlib.md5(" ".join(words[i:i + SHINGLE_SIZE]).encode()).hexdigest()[:12]
        for i in range(len(words) - SHINGLE_SIZE + 1)
    }


def _extract_snippets(own_text, other_text, max_snippets=5, context_words=8):
    """Return up to max_snippets overlapping word-sequences that appear in both texts.

    Strategy: find the SHINGLE_SIZE-word windows (same as the plagiarism shingles) that
    appear verbatim in both texts and emit them with a small context window so reviewers
    can see what overlaps without reading the whole document.
    """
    own_words = normalize_vi(own_text).split()
    other_words = normalize_vi(other_text).split()
    other_set = set(
        " ".join(other_words[j:j + SHINGLE_SIZE])
        for j in range(max(0, len(other_words) - SHINGLE_SIZE + 1))
    )
    seen, snippets = set(), []
    for i in range(len(own_words) - SHINGLE_SIZE + 1):
        window = " ".join(own_words[i:i + SHINGLE_SIZE])
        if window in other_set and window not in seen:
            seen.add(window)
            start = max(0, i - context_words)
            end = min(len(own_words), i + SHINGLE_SIZE + context_words)
            snippets.append(" ".join(own_words[start:end]))
            if len(snippets) >= max_snippets:
                break
    return snippets


def run_similarity_check(version, max_candidates=2000):
    """So nội dung một phiên bản bài nộp với phiên bản mới nhất của các đồ án khác.

    Điểm = tỷ lệ % các cụm 5 từ của bài này xuất hiện trong bài so sánh (containment).
    Đây là kiểm tra nội bộ trong kho bài nộp của Khoa; có thể thay bằng Turnitin/iThenticate
    qua setting PLAGIARISM_PROVIDER mà không đổi API.

    Exclusions:
    - Same project (all versions).
    - Any other project by the same student (earlier projects from the same student
      re-submitted in a new batch should not count as plagiarism against themselves).

    Performance note: max_candidates caps the comparison set; complexity is O(N) in
    total shingle count across candidates where N <= max_candidates.

    Backward-compatible JSON keys: project_id, version_id, kind, topic_title_vi,
    batch_code, student_code, score. New key: snippets (list of up to 5 overlapping
    text passages, each ≤ ~20 normalized words, to help reviewers verify findings).
    """
    from .models import SubmissionVersion

    own = _shingles(version.extracted_text)
    if len(own) < MIN_SHINGLES:
        version.similarity_status = "UNSUPPORTED"
        version.similarity_score = None
        version.similarity_matches = []
        version.similarity_checked_at = timezone.now()
        version.save(update_fields=["similarity_status", "similarity_score", "similarity_matches", "similarity_checked_at"])
        return version

    # Build exclusion set: same project + any project by the same student.
    own_student_id = version.project.student_id if version.project_id else None
    exclude_project_ids_qs = SubmissionVersion.objects.filter(
        project__student_id=own_student_id
    ).values_list("project_id", flat=True).distinct() if own_student_id else []

    latest_ids = (
        SubmissionVersion.objects.exclude(project_id=version.project_id)
        .exclude(project_id__in=list(exclude_project_ids_qs))
        .exclude(extracted_text="")
        .values("project_id", "kind")
        .annotate(latest=Max("id"))
        .values_list("latest", flat=True)
    )
    candidates = SubmissionVersion.objects.filter(id__in=list(latest_ids)[:max_candidates]).select_related(
        "project__student__user", "project__batch"
    )

    matches = []
    for other in candidates:
        other_shingles = _shingles(other.extracted_text)
        common = own & other_shingles
        if not common:
            continue
        score = round(100.0 * len(common) / len(own), 1)
        if score >= 1.0:
            p = other.project
            snippets = _extract_snippets(version.extracted_text, other.extracted_text)
            matches.append({
                "version_id": other.id,
                "project_id": p.id,
                "kind": other.kind,
                "topic_title_vi": p.topic_title_vi,
                "batch_code": getattr(p.batch, "batch_code", ""),
                "student_code": getattr(p.student, "registration_no", "") if p.student_id else "",
                "score": score,
                "snippets": snippets,  # new: up to 5 overlapping passages for reviewer inspection
            })
    matches.sort(key=lambda m: m["score"], reverse=True)
    version.similarity_status = "CHECKED"
    version.similarity_score = matches[0]["score"] if matches else 0.0
    version.similarity_matches = matches[:10]
    version.similarity_checked_at = timezone.now()
    version.save(update_fields=["similarity_status", "similarity_score", "similarity_matches", "similarity_checked_at"])
    return version


def similarity_level(score):
    if score is None:
        return "UNKNOWN"
    threshold = float(getattr(settings, "PLAGIARISM_WARNING_THRESHOLD", 30.0))
    if score >= threshold:
        return "HIGH"
    if score >= threshold / 2:
        return "MEDIUM"
    return "LOW"


def create_submission_version(project, uploaded_file, kind, user, note="", check_similarity=True):
    """Lưu một phiên bản mới (không ghi đè bản cũ), tính SHA-256 và kiểm tra tương đồng."""
    from .models import SubmissionVersion

    hasher = hashlib.sha256()
    uploaded_file.seek(0)
    for chunk in uploaded_file.chunks():
        hasher.update(chunk)
    uploaded_file.seek(0)
    text = extract_text(uploaded_file, uploaded_file.name)

    with transaction.atomic():
        # Khóa đồ án để hai lần nộp đồng thời không lấy trùng số phiên bản.
        type(project).objects.select_for_update().filter(pk=project.pk).first()
        last = SubmissionVersion.objects.filter(project=project, kind=kind).aggregate(m=Max("version_no"))["m"] or 0
        version = SubmissionVersion(
            project=project,
            kind=kind,
            version_no=last + 1,
            original_name=(uploaded_file.name or "")[:255],
            file_size=getattr(uploaded_file, "size", 0) or 0,
            sha256=hasher.hexdigest(),
            note=note or "",
            uploaded_by=user,
            extracted_text=text,
        )
        version.file.save(uploaded_file.name, uploaded_file, save=False)
        version.save()

    if check_similarity and kind in ("OUTLINE", "REPORT"):
        try:
            run_similarity_check(version)
        except Exception as exc:  # không để lỗi kiểm tra làm hỏng việc nộp bài
            logger.warning("Similarity check failed for version %s: %s", version.id, exc)
    return version


# ==============================================================================
# Rubric và phát hiện lệch điểm
# ==============================================================================

def compute_rubric_total(rubric, criterion_scores):
    """Kiểm tra điểm từng tiêu chí và quy tổng về thang 10. Trả (scores_sạch, total_10) hoặc raise ValueError.

    Hỗ trợ weight (trọng số) per-criterion (backward-compatible):
      - Nếu weight=None thì dùng max_score làm trọng số (hành vi cũ).
      - Công thức: total_10 = sum(score_i/max_i * w_i) / sum(w_i) * 10
      - Với w_i = max_score khi weight=None, kết quả trùng khớp hành vi cũ.
    """
    criteria = list(rubric.criteria.all())
    if not criteria:
        raise ValueError("Rubric chưa có tiêu chí nào.")
    cleaned, weighted_sum, total_weight = {}, 0.0, 0.0
    for c in criteria:
        raw = criterion_scores.get(str(c.id), criterion_scores.get(c.id))
        if raw is None or raw == "":
            raise ValueError(f"Thiếu điểm tiêu chí '{c.name}'.")
        try:
            val = float(raw)
        except (TypeError, ValueError):
            raise ValueError(f"Điểm tiêu chí '{c.name}' không hợp lệ.")
        if val < 0 or val > c.max_score:
            raise ValueError(f"Điểm tiêu chí '{c.name}' phải trong khoảng 0–{c.max_score:g}.")
        cleaned[str(c.id)] = val
        w = c.weight if c.weight is not None else c.max_score
        weighted_sum += (val / c.max_score) * w if c.max_score else 0.0
        total_weight += w
    return cleaned, round(weighted_sum / total_weight * 10, 2) if total_weight else 0.0


def score_discrepancy(project):
    """Gom mọi nguồn điểm (GVHD, phản biện, hội đồng, rubric) và cảnh báo khi lệch quá ngưỡng.

    Mô phỏng quy trình "reconciliation" của các trường quốc tế: khi hai giám khảo lệch
    nhau quá ngưỡng, Khoa cần xem lại hoặc mời giám khảo thứ ba.
    """
    threshold = float(getattr(settings, "SCORE_DISCREPANCY_THRESHOLD", 2.0))
    entries = []
    if project.supervisor_score is not None:
        entries.append({"source": "SUPERVISOR", "evaluator": project.supervisor.user.get_full_name() if project.supervisor_id else "", "score_10": float(project.supervisor_score)})
    if project.reviewer_score is not None:
        entries.append({"source": "REVIEWER", "evaluator": project.reviewer.user.get_full_name() if project.reviewer_id else "", "score_10": float(project.reviewer_score)})
    for live in project.council_scores.select_related("member__user"):
        entries.append({"source": "COUNCIL", "evaluator": live.member.user.get_full_name(), "score_10": float(live.total_score)})
    # Chỉ tính phiếu đã SUBMITTED (đã chính thức nộp); bản DRAFT chưa được tính discrepancy
    for rs in project.rubric_scores.filter(status="SUBMITTED").select_related("rubric", "evaluator"):
        entries.append({
            "source": f"RUBRIC_{rs.rubric.evaluator_role}",
            "evaluator": rs.evaluator.get_full_name() or rs.evaluator.username,
            "score_10": float(rs.total_10),
        })

    scores = [e["score_10"] for e in entries]
    spread = round(max(scores) - min(scores), 2) if len(scores) >= 2 else 0.0
    mean = round(sum(scores) / len(scores), 2) if scores else None
    for e in entries:
        e["deviation"] = round(e["score_10"] - mean, 2) if mean is not None else 0.0
        e["is_outlier"] = abs(e["deviation"]) >= threshold
    return {
        "project_id": project.id,
        "entries": entries,
        "mean_score": mean,
        "spread": spread,
        "threshold": threshold,
        "needs_reconciliation": spread >= threshold,
    }


# ==============================================================================
# Thống kê cho Khoa
# ==============================================================================

def faculty_analytics(batch=None, department_name=None):
    """Thống kê tổng hợp cho Khoa.

    Args:
        batch: AcademicBatch instance or None (all batches).
        department_name: Optional str. When provided, filters to projects whose
            supervisor's department_name matches (case-insensitive contains).
            Useful when faculty has multiple departments (CNTT, KHMT, etc.).

    Score distribution buckets: score S goes into bucket i = min(floor(S), 9),
    labelled "i – i+1".  So score 9.0 → bucket 9 ("9-10"), score 10.0 → bucket 9.
    Pass rate denominator = only projects with status PASSED or FAILED (projects still
    in progress are not counted as failures).
    """
    from .models import (
        GraduationProject, SupervisionTask, SupervisorQuota, ThesisDeferralRequest, FinalGradeSummary,
    )

    projects = GraduationProject.objects.all()
    if batch is not None:
        projects = projects.filter(batch=batch)
    if department_name:
        projects = projects.filter(supervisor__department_name__icontains=department_name)

    status_counts = dict(projects.values_list("status").annotate(c=Count("id")).values_list("status", "c"))
    total = sum(status_counts.values())
    passed = status_counts.get("PASSED", 0)
    failed = status_counts.get("FAILED", 0)

    # Tải hướng dẫn theo GV
    load = list(
        projects.values("supervisor_id", "supervisor__user__first_name", "supervisor__user__last_name")
        .annotate(assigned=Count("id"))
        .order_by("-assigned")
    )
    quota_map = {}
    if batch is not None:
        quota_map = {q.supervisor_id: q.max_total_quota for q in SupervisorQuota.objects.filter(batch=batch)}
    supervisor_load = [{
        "supervisor_id": row["supervisor_id"],
        "name": f"{row['supervisor__user__last_name'] or ''} {row['supervisor__user__first_name'] or ''}".strip(),
        "assigned": row["assigned"],
        "quota": quota_map.get(row["supervisor_id"]),
    } for row in load]

    # Phân bố điểm (thang 10)
    grades = FinalGradeSummary.objects.filter(project__in=projects)
    buckets = Counter()
    scores = []
    for g in grades:
        val = getattr(g, "final_score_10", None)
        if val is None:
            continue
        scores.append(float(val))
        buckets[min(int(float(val)), 9)] += 1
    score_distribution = [{"range": f"{i}-{i + 1}", "count": buckets.get(i, 0)} for i in range(10)]

    tasks = SupervisionTask.objects.filter(project__in=projects)
    task_total = tasks.count()
    today = timezone.localdate()
    overdue = tasks.filter(due_date__lt=today, is_completed=False).count()
    late = tasks.filter(is_late=True).count()

    preference = {}
    try:
        from .models import ProposedAllocation
        alloc = ProposedAllocation.objects.all()
        if batch is not None:
            alloc = alloc.filter(batch=batch)
        preference = {
            str(k): v for k, v in alloc.values_list("matched_preference").annotate(c=Count("id")).values_list("matched_preference", "c")
        }
    except Exception:
        preference = {}

    deferrals = ThesisDeferralRequest.objects.filter(project__in=projects)
    return {
        "batch_id": getattr(batch, "id", None),
        "department_filter": department_name,
        "total_projects": total,
        "status_counts": status_counts,
        "pass_rate": round(passed / (passed + failed) * 100, 1) if (passed + failed) else None,
        "average_final_score": round(sum(scores) / len(scores), 2) if scores else None,
        "score_distribution": score_distribution,
        "supervisor_load": supervisor_load,
        "tasks": {
            "total": task_total,
            "overdue": overdue,
            "late_submissions": late,
            "late_rate": round(late / task_total * 100, 1) if task_total else 0.0,
        },
        "preference_satisfaction": preference,
        "deferrals": dict(deferrals.values_list("status").annotate(c=Count("id")).values_list("status", "c")),
        "generated_at": timezone.now().isoformat(),
    }


# ==============================================================================
# Lịch iCal (RFC 5545)
# ==============================================================================

def _ics_escape(text):
    return (str(text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
            .replace("\r\n", "\\n").replace("\n", "\\n"))


def _fold(line):
    """RFC 5545: dòng dài hơn 75 octet phải gập lại."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, current = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        if len(current) + len(b) > 74:
            parts.append(current.decode("utf-8"))
            current = b
        else:
            current += b
    parts.append(current.decode("utf-8"))
    return "\r\n ".join(parts)


def _parse_time_range(text):
    m = re.findall(r"(\d{1,2}):(\d{2})", text or "")
    if not m:
        return None, None
    start = (int(m[0][0]), int(m[0][1]))
    end = (int(m[1][0]), int(m[1][1])) if len(m) > 1 else None
    return start, end


def collect_calendar_events(user):
    """Các sự kiện liên quan tới người dùng: hạn task, buổi gặp GVHD, lịch bảo vệ, hạn đợt."""
    from .models import GraduationProject, SupervisionTask, SupervisionMeetingLog, DefenseScheduleSlot

    projects = GraduationProject.objects.none()
    if hasattr(user, "student_profile"):
        projects = GraduationProject.objects.filter(student__user=user)
    if hasattr(user, "supervisor_profile"):
        projects = projects | GraduationProject.objects.filter(supervisor__user=user) | GraduationProject.objects.filter(reviewer__user=user)
    projects = projects.distinct()

    events = []
    for t in SupervisionTask.objects.filter(project__in=projects, due_date__isnull=False).select_related("project"):
        events.append({
            "uid": f"task-{t.id}", "all_day": True, "date": t.due_date,
            "summary": f"[Hạn task] {t.title}",
            "description": f"Đồ án: {t.project.topic_title_vi}\nTrạng thái: {t.status}",
        })
    for m in SupervisionMeetingLog.objects.filter(project__in=projects).select_related("project"):
        start, end = _parse_time_range(m.meeting_time)
        events.append({
            "uid": f"meeting-{m.id}", "all_day": start is None, "date": m.meeting_date, "start": start, "end": end,
            "summary": f"[Gặp GVHD] {m.project.topic_title_vi}",
            "description": m.content_discussed or "", "location": m.location_or_link or "",
        })
    slots = DefenseScheduleSlot.objects.filter(slot_date__isnull=False).select_related("project", "council")
    slots = slots.filter(project__in=projects) | slots.filter(council__members__user=user)
    for s in slots.distinct():
        events.append({
            "uid": f"defense-{s.id}", "all_day": s.start_time is None, "date": s.slot_date,
            "start": (s.start_time.hour, s.start_time.minute) if s.start_time else None,
            "end": (s.end_time.hour, s.end_time.minute) if s.end_time else None,
            "summary": f"[Bảo vệ] {s.project.topic_title_vi}",
            "description": f"Hội đồng: {getattr(s.council, 'council_name', '')}", "location": s.room or "",
        })
    for p in projects.select_related("batch"):
        if p.batch and p.batch.end_date:
            events.append({
                "uid": f"batch-end-{p.batch_id}", "all_day": True, "date": p.batch.end_date,
                "summary": f"[Kết thúc đợt] {p.batch.batch_name}", "description": "",
            })
    # Bỏ trùng (vd. hạn đợt của nhiều đồ án cùng đợt)
    unique = {}
    for e in events:
        unique.setdefault(e["uid"], e)
    return list(unique.values())


def build_ics(events, calendar_name="Smart FYP UTC"):
    stamp = timezone.now().strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UTC//Smart FYP//VI", "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH", f"X-WR-CALNAME:{_ics_escape(calendar_name)}", "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    ]
    for e in events:
        d = e["date"]
        lines += ["BEGIN:VEVENT", f"UID:{e['uid']}@smart-fyp-utc", f"DTSTAMP:{stamp}"]
        if e.get("all_day") or not e.get("start"):
            lines.append(f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}")
            lines.append(f"DTEND;VALUE=DATE:{(d + timedelta(days=1)).strftime('%Y%m%d')}")
        else:
            sh, sm = e["start"]
            eh, em = e.get("end") or (min(sh + 1, 23), sm)
            lines.append(f"DTSTART;TZID=Asia/Ho_Chi_Minh:{d.strftime('%Y%m%d')}T{sh:02d}{sm:02d}00")
            lines.append(f"DTEND;TZID=Asia/Ho_Chi_Minh:{d.strftime('%Y%m%d')}T{eh:02d}{em:02d}00")
        lines.append(f"SUMMARY:{_ics_escape(e['summary'])}")
        if e.get("description"):
            lines.append(f"DESCRIPTION:{_ics_escape(e['description'])}")
        if e.get("location"):
            lines.append(f"LOCATION:{_ics_escape(e['location'])}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


# ==============================================================================
# Nhắc hạn task
# ==============================================================================

REMINDER_MILESTONES = {3: "D-3", 1: "D-1"}


def send_deadline_reminders(today=None, send_email=True):
    """Gửi thông báo (và email nếu bật) cho SV có task sắp tới hạn hoặc đã quá hạn. Idempotent."""
    from .models import SupervisionTask, DeadlineReminderLog
    from .services import NotificationService

    today = today or timezone.localdate()
    open_tasks = SupervisionTask.objects.filter(is_completed=False, due_date__isnull=False).exclude(
        status__in=["DONE", "COMPLETED", "SUBMITTED"]
    ).select_related("project__student__user")

    sent = 0
    for task in open_tasks:
        days_left = (task.due_date - today).days
        if days_left in REMINDER_MILESTONES:
            milestone = REMINDER_MILESTONES[days_left]
            title = f"Task '{task.title}' sẽ hết hạn sau {days_left} ngày"
        elif days_left < 0:
            milestone = "OVERDUE"
            title = f"Task '{task.title}' đã quá hạn {-days_left} ngày"
        else:
            continue
        student = getattr(task.project, "student", None)
        user = getattr(student, "user", None)
        if not user:
            continue
        _, created = DeadlineReminderLog.objects.get_or_create(task=task, user=user, milestone=milestone)
        if not created:
            continue
        NotificationService.create_notification(
            user=user,
            notification_type="deadline_reminder",
            title=title,
            message=f"Hạn nộp: {task.due_date.strftime('%d/%m/%Y')}. Đồ án: {task.project.topic_title_vi}",
            action_url="/student/dashboard?tab=stage5",
            send_email=send_email,
        )
        sent += 1
    return sent


# ==============================================================================
# Kho lưu trữ đồ án
# ==============================================================================

def archive_project(project, user, data):
    from .models import ThesisArchiveRecord, SubmissionVersion

    if project.status != "PASSED":
        raise ValueError("Chỉ lưu trữ được đồ án đã bảo vệ đạt (PASSED).")
    final_version = None
    version_id = data.get("final_version_id")
    if version_id:
        final_version = SubmissionVersion.objects.filter(id=version_id, project=project).first()
        if not final_version:
            raise ValueError("Phiên bản bài nộp không thuộc đồ án này.")
    else:
        final_version = SubmissionVersion.objects.filter(project=project, kind="REPORT").order_by("-version_no").first()

    visibility = str(data.get("visibility") or "PUBLIC").upper()
    if visibility not in dict(ThesisArchiveRecord.VISIBILITY_CHOICES):
        raise ValueError("Chế độ công bố không hợp lệ.")
    embargo_until = data.get("embargo_until") or None
    if isinstance(embargo_until, str):
        try:
            embargo_until = date.fromisoformat(embargo_until)
        except ValueError:
            raise ValueError("embargo_until phải có dạng YYYY-MM-DD.")
    if visibility == "EMBARGOED":
        if not embargo_until:
            raise ValueError("Cần ngày kết thúc embargo.")
        max_years = int(getattr(settings, "ARCHIVE_MAX_EMBARGO_YEARS", 3))
        if embargo_until > timezone.localdate() + timedelta(days=365 * max_years):
            raise ValueError(f"Thời hạn embargo tối đa {max_years} năm.")
        if not str(data.get("embargo_reason") or "").strip():
            raise ValueError("Cần nêu lý do embargo (bí mật doanh nghiệp, chờ công bố bài báo, ...).")

    final = getattr(project, "final_grade_summary", None)
    record, created = ThesisArchiveRecord.objects.update_or_create(
        project=project,
        defaults={
            "title": data.get("title") or project.topic_title_vi,
            "abstract": data.get("abstract") or "",
            "keywords": data.get("keywords") or "",
            "final_version": final_version,
            "visibility": visibility,
            "embargo_until": embargo_until if visibility == "EMBARGOED" else None,
            "embargo_reason": (data.get("embargo_reason") or "") if visibility == "EMBARGOED" else "",
            "license": data.get("license") or "All rights reserved",
            "final_score": getattr(final, "final_score_10", None),
            "archived_by": user,
        },
    )
    try:
        from .models import AuditLog
        AuditLog.objects.create(
            user=user,
            action_type="archive_create" if created else "archive_update",
            description=(
                f"{'Tạo mới' if created else 'Cập nhật'} kho lưu trữ đồ án: "
                f"project_id={project.id}, title={record.title!r}, "
                f"visibility={visibility}, embargo_until={embargo_until}"
            ),
            field_name="visibility",
            new_value=visibility,
        )
    except Exception:
        pass
    return record


# ==============================================================================
# Lưu giữ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
# ==============================================================================

def apply_data_retention(years=None, apply=False, today=None):
    """Xóa dữ liệu cá nhân không còn cần thiết của các đợt đã đóng quá `years` năm.

    Giữ lại: hồ sơ đồ án, điểm, bản lưu trữ chính thức (phục vụ kiểm định, cấp bằng).
    Xóa: file minh chứng bảo lưu, file báo cáo tuần, file nộp task, các phiên bản bài nộp
    không phải bản lưu trữ, thông tin thực tập/nguyện vọng. Mặc định chỉ chạy thử (dry-run).
    """
    from .models import (
        AcademicBatch, GraduationProject, ThesisDeferralRequest, WeeklyProgressReport,
        SupervisionTask, SubmissionVersion, InternshipInfo, StudentPreference, ThesisArchiveRecord,
    )

    years = int(years if years is not None else getattr(settings, "DATA_RETENTION_YEARS", 5))
    min_years = int(getattr(settings, "DATA_RETENTION_MIN_YEARS", 1))
    if years < min_years:
        # years<=0 would put the cutoff in the future and wipe every closed batch.
        raise ValueError(f"Số năm lưu giữ phải >= {min_years}.")
    today = today or timezone.localdate()
    cutoff = today - timedelta(days=365 * years)
    batches = AcademicBatch.objects.filter(is_closed=True, end_date__isnull=False, end_date__lt=cutoff)
    projects = GraduationProject.objects.filter(batch__in=batches)
    kept_versions = ThesisArchiveRecord.objects.filter(project__in=projects).values_list("final_version_id", flat=True)

    plan = {
        "cutoff": cutoff.isoformat(),
        "batches": list(batches.values_list("batch_code", flat=True)),
        "deferral_evidence_files": ThesisDeferralRequest.objects.filter(project__in=projects).exclude(evidence_file="").exclude(evidence_file__isnull=True),
        "weekly_report_files": WeeklyProgressReport.objects.filter(project__in=projects).exclude(attached_file="").exclude(attached_file__isnull=True),
        "task_deliverable_files": SupervisionTask.objects.filter(project__in=projects).exclude(deliverable_file="").exclude(deliverable_file__isnull=True),
        "submission_versions": SubmissionVersion.objects.filter(project__in=projects).exclude(id__in=[v for v in kept_versions if v]),
        "internship_info": InternshipInfo.objects.filter(batch__in=batches),
        "student_preferences": StudentPreference.objects.filter(batch__in=batches),
    }
    summary = {k: (v.count() if hasattr(v, "count") and not isinstance(v, (list, str)) else v) for k, v in plan.items()}
    summary["applied"] = False
    if not apply:
        return summary

    def _clear_file(qs, field):
        for obj in qs:
            f = getattr(obj, field)
            if f:
                f.delete(save=False)
            setattr(obj, field, None)
            obj.save(update_fields=[field])

    with transaction.atomic():
        _clear_file(plan["deferral_evidence_files"], "evidence_file")
        _clear_file(plan["weekly_report_files"], "attached_file")
        _clear_file(plan["task_deliverable_files"], "deliverable_file")
        for v in plan["submission_versions"]:
            if v.file:
                v.file.delete(save=False)
            v.delete()
        plan["internship_info"].delete()
        plan["student_preferences"].delete()
    summary["applied"] = True
    try:
        from .models import AuditLog
        AuditLog.objects.create(
            user=None,
            action_type="retention_apply",
            description=(
                f"Áp dụng chính sách lưu giữ dữ liệu: cutoff={summary['cutoff']}, "
                f"batches={summary['batches']}"
            ),
        )
    except Exception:
        pass
    return summary
