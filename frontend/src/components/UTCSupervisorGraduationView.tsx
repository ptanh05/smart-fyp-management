import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';


export const UTCSupervisorGraduationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'outlines' | 'weekly' | 'eval' | 'reviewer'>('students');
  const [projects, setProjects] = useState<any[]>([]);
  const [reviewerProjects, setReviewerProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Outline Review Modal
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [verdict, setVerdict] = useState<'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED'>('APPROVED');
  const [outlineComments, setOutlineComments] = useState('');
  const [showOutlineModal, setShowOutlineModal] = useState(false);

  // Weekly Feedback Modal
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [weeklyRating, setWeeklyRating] = useState<'GOOD' | 'ACCEPTABLE' | 'LATE' | 'UNSATISFACTORY'>('GOOD');
  const [weeklyFeedback, setWeeklyFeedback] = useState('');
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Supervisor Defense Evaluation Modal
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalScore, setEvalScore] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [isEligible, setIsEligible] = useState(true);

  // Reviewer Score Modal
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [revScore, setRevScore] = useState('');
  const [revFeedback, setRevFeedback] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, revRes] = await Promise.all([
        axios.get(`${API_BASE}/supervisor/graduation-projects/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/reviewer/assigned-projects/`, { headers: getHeaders() }).catch(() => null),
      ]);
      if (projRes?.data) setProjects(projRes.data);
      if (revRes?.data) setReviewerProjects(revRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReviewOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/outline/review/`,
        {
          project_id: selectedProject.id,
          verdict,
          comments: outlineComments,
        },
        { headers: getHeaders()}
      );
      alert('Đã cập nhật kết quả duyệt đề cương!');
      setShowOutlineModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleFeedbackWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/weekly-feedback/`,
        {
          report_id: selectedReport.id,
          rating: weeklyRating,
          feedback: weeklyFeedback,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu nhận xét và đánh giá tiến độ tuần!');
      setShowWeeklyModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSupervisorEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/supervisor/defense-evaluation/`,
        {
          project_id: selectedProject.id,
          supervisor_score: Number(evalScore),
          supervisor_feedback: evalFeedback,
          is_eligible_for_defense: isEligible,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu phiếu đánh giá GVHD thành công!');
      setShowEvalModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.supervisor_score?.[0] || err.message));
    }
  };

  const handleReviewerEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(
        `${API_BASE}/reviewer/submit-evaluation/`,
        {
          project_id: selectedProject.id,
          reviewer_score: Number(revScore),
          reviewer_feedback: revFeedback,
        },
        { headers: getHeaders()}
      );
      alert('Đã lưu phiếu phản biện thành công!');
      setShowReviewerModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.reviewer_score?.[0] || err.message));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải danh sách sinh viên hướng dẫn...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        {[
          { key: 'students', label: `1. Sinh viên hướng dẫn (${projects.length})`, icon: '👨‍🎓' },
          { key: 'outlines', label: '2. Duyệt Đề cương', icon: '📝' },
          { key: 'weekly', label: '3. Báo cáo tuần & Đánh giá', icon: '📅' },
          { key: 'eval', label: '4. Đánh giá sơ khảo GVHD', icon: '⭐' },
          { key: 'reviewer', label: `5. Đồ án Phản biện (${reviewerProjects.length})`, icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Students List */}
      {activeTab === 'students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h3 className="font-bold text-base text-slate-100 mb-4">Danh sách Sinh viên đang hướng dẫn ĐATN</h3>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Chưa có sinh viên nào được phân công.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3">MSSV</th>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Lớp / Ngành</th>
                    <th className="p-3">Tên đề tài đồ án</th>
                    <th className="p-3">Điện thoại / Email</th>
                    <th className="p-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-950/40">
                      <td className="p-3 font-mono font-semibold text-blue-400">{p.student_reg_no}</td>
                      <td className="p-3 font-medium text-slate-100">{p.student_name}</td>
                      <td className="p-3 text-slate-400">{p.student_class}</td>
                      <td className="p-3 font-medium text-slate-200 max-w-xs">{p.topic_title_vi}</td>
                      <td className="p-3 text-slate-400">
                        <div>{p.student_phone || 'N/A'}</div>
                        <div className="text-slate-500">{p.student_email}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
                          {p.status_display || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Outlines Review */}
      {activeTab === 'outlines' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Xét duyệt Đề cương chi tiết</h3>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">{p.student_reg_no}</span>
                    <span className="font-semibold text-sm text-slate-100">{p.student_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      p.status === 'OUTLINE_APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'OUTLINE_REVISION' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {p.status_display || p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProject(p);
                    setOutlineComments(p.outline_review?.comments || '');
                    setShowOutlineModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Xét duyệt Đề cương
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Weekly Reports */}
      {activeTab === 'weekly' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đánh giá Báo cáo tiến độ tuần (1 - 15)</h3>
          <div className="space-y-4">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                    <span className="text-xs text-slate-400 ml-2">({p.student_reg_no})</span>
                  </div>
                  <span className="text-xs text-slate-400">Đã nộp: {p.weekly_reports?.length || 0} / 15 tuần</span>
                </div>

                {p.weekly_reports?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Sinh viên chưa nộp báo cáo tuần nào.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {p.weekly_reports?.map((r: any) => (
                      <div key={r.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-400">Tuần {r.week_number}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                            {r.supervisor_rating_display || r.supervisor_rating}
                          </span>
                        </div>
                        <p className="text-slate-300 line-clamp-2">{r.summary_content}</p>
                        {r.supervisor_feedback && (
                          <p className="text-emerald-400 italic">Nhận xét: {r.supervisor_feedback}</p>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setWeeklyFeedback(r.supervisor_feedback || '');
                            setShowWeeklyModal(true);
                          }}
                          className="mt-1 text-xs text-blue-400 hover:underline"
                        >
                          ✏️ Đánh giá / Sửa nhận xét
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Final Supervisor Evaluation */}
      {activeTab === 'eval' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đánh giá Sơ khảo & Chấm điểm GVHD (40%)</h3>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                    <span className="text-xs text-slate-400">({p.student_reg_no})</span>
                    {p.is_eligible_for_defense && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        ĐỦ ĐIỀU KIỆN BẢO VỆ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Điểm GVHD: {p.supervisor_score !== null ? `${p.supervisor_score} / 10đ` : 'Chưa chấm'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProject(p);
                    setEvalScore(p.supervisor_score !== null ? p.supervisor_score.toString() : '');
                    setEvalFeedback(p.supervisor_feedback || '');
                    setIsEligible(p.is_eligible_for_defense);
                    setShowEvalModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-600/30"
                >
                  Chấm điểm GVHD
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Reviewer Evaluation */}
      {activeTab === 'reviewer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-base text-slate-100">Đồ án được phân công Phản biện độc lập (20%)</h3>
          {reviewerProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Chưa có đồ án nào được phân công cho Thầy/Cô phản biện.</div>
          ) : (
            <div className="space-y-3">
              {reviewerProjects.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                      <span className="text-xs text-slate-400">({p.student_reg_no})</span>
                      <span className="text-xs text-slate-400">GVHD: {p.supervisor?.full_name}</span>
                    </div>
                    <p className="text-xs text-slate-300"><b>Đề tài:</b> {p.topic_title_vi}</p>
                    <p className="text-xs text-indigo-400 font-semibold">
                      Điểm GVPB: {p.reviewer_score !== null ? `${p.reviewer_score} / 10đ` : 'Chưa chấm phản biện'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedProject(p);
                      setRevScore(p.reviewer_score !== null ? p.reviewer_score.toString() : '');
                      setRevFeedback(p.reviewer_feedback || '');
                      setShowReviewerModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-indigo-600/30"
                  >
                    Chấm Phản biện
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Outline Review */}
      {showOutlineModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Xét duyệt Đề cương ĐATN</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleReviewOutline} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kết luận xét duyệt</label>
                <select
                  value={verdict}
                  onChange={(e) => setVerdict(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="APPROVED">ĐẠT YÊU CẦU (Phê duyệt thực hiện)</option>
                  <option value="REVISION_REQUIRED">YÊU CẦU CHỈNH SỬA LẠI</option>
                  <option value="REJECTED">KHÔNG ĐẠT / HỦY ĐỀ TÀI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ý kiến & Nhận xét</label>
                <textarea
                  rows={3}
                  value={outlineComments}
                  onChange={(e) => setOutlineComments(e.target.value)}
                  placeholder="Ghi chú chi tiết cho sinh viên chỉnh sửa..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOutlineModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  Lưu kết quả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Weekly Feedback */}
      {showWeeklyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4">Đánh giá Báo cáo Tuần {selectedReport?.week_number}</h3>
            <form onSubmit={handleFeedbackWeekly} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Xếp loại tuần</label>
                <select
                  value={weeklyRating}
                  onChange={(e) => setWeeklyRating(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="GOOD">Tốt / Đạt tiến độ</option>
                  <option value="ACCEPTABLE">Chấp nhận được</option>
                  <option value="LATE">Chậm tiến độ</option>
                  <option value="UNSATISFACTORY">Không đạt yêu cầu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét của GVHD</label>
                <textarea
                  rows={3}
                  value={weeklyFeedback}
                  onChange={(e) => setWeeklyFeedback(e.target.value)}
                  placeholder="Ghi chú góp ý cho sinh viên..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWeeklyModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  Lưu nhận xét
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Supervisor Eval */}
      {showEvalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Phiếu Đánh giá của Giảng viên hướng dẫn</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleSupervisorEvaluation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Điểm hướng dẫn (Thang 10, tối đa 10.0đ)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  required
                  placeholder="VD: 8.5"
                  value={evalScore}
                  onChange={(e) => setEvalScore(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={isEligible}
                    onChange={(e) => setIsEligible(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs font-bold text-emerald-400">Đồng ý cho sinh viên bảo vệ trước Hội đồng</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét chi tiết về thái độ & kết quả ĐATN</label>
                <textarea
                  rows={3}
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  placeholder="Sinh viên hoàn thành đầy đủ khối lượng công việc, ứng dụng demo chạy tốt..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                >
                  Lưu điểm GVHD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reviewer Eval */}
      {showReviewerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Phiếu Chấm Giảng viên Phản biện (20%)</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.student_name} - {selectedProject?.topic_title_vi}</p>
            <form onSubmit={handleReviewerEvaluation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Điểm phản biện (Thang 10, tối đa 10.0đ)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  required
                  placeholder="VD: 8.0"
                  value={revScore}
                  onChange={(e) => setRevScore(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nhận xét & Câu hỏi phản biện</label>
                <textarea
                  rows={3}
                  value={revFeedback}
                  onChange={(e) => setRevFeedback(e.target.value)}
                  placeholder="Đề tài có tính ứng dụng cao, câu hỏi phản biện: Phương pháp bảo mật xác thực được thực hiện ra sao?..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewerModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
                >
                  Lưu điểm Phản biện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
