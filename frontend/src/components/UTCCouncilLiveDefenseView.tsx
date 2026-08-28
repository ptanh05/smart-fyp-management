import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/app';


export const UTCCouncilLiveDefenseView: React.FC = () => {
  const [councilData, setCouncilData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scoring Form
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [scorePres, setScorePres] = useState<number | string>(2.5);
  const [scoreContent, setScoreContent] = useState<number | string>(2.5);
  const [scoreQa, setScoreQa] = useState<number | string>(1.5);
  const [scoreDemo, setScoreDemo] = useState<number | string>(1.5);
  const [scoreComments, setScoreComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/council/live-session/`, { headers: getHeaders() });
      setCouncilData(res.data.council);
      setProjects(res.data.projects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenScoreModal = (project: any) => {
    setSelectedProject(project);
    if (project.my_score) {
      setScorePres(project.my_score.score_presentation);
      setScoreContent(project.my_score.score_content);
      setScoreQa(project.my_score.score_qa);
      setScoreDemo(project.my_score.score_demo);
      setScoreComments(project.my_score.comments || '');
    } else {
      setScorePres(2.5);
      setScoreContent(2.5);
      setScoreQa(1.5);
      setScoreDemo(1.5);
      setScoreComments('');
    }
    setShowScoreModal(true);
  };

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      setSubmitting(true);
      const res = await axios.post(
        `${API_BASE}/council/submit-score/`,
        {
          project_id: selectedProject.id,
          score_presentation: Number(scorePres),
          score_content: Number(scoreContent),
          score_qa: Number(scoreQa),
          score_demo: Number(scoreDemo),
          comments: scoreComments,
        },
        { headers: getHeaders() }
      );
      alert(res.data.message || 'Đã chấm điểm thành công!');
      setShowScoreModal(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi chấm điểm: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const totalPreview = (Number(scorePres) || 0) + (Number(scoreContent) || 0) + (Number(scoreQa) || 0) + (Number(scoreDemo) || 0);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải phiên bảo vệ trực tiếp của Hội đồng...</div>;
  }

  if (!councilData) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <h4 className="text-base font-bold text-slate-200">Không tìm thấy phiên bảo vệ</h4>
        <p className="text-xs text-slate-400">Bạn hiện không được phân công vào Hội đồng bảo vệ nào trong đợt này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Council Info Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Hội đồng #{councilData.council_number}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              Vai trò: {councilData.my_role}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">{councilData.council_name}</h2>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
            <span>🏛️ Phòng: <b>{councilData.defense_room || 'TBA'}</b></span>
            <span>📅 Ngày: <b>{councilData.session_date || 'TBA'}</b></span>
            <span>⏰ Ca: <b>{councilData.session_time}</b></span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">Tổng số đề tài bảo vệ</span>
          <p className="text-2xl font-bold text-emerald-400">{projects.length} Sinh viên</p>
        </div>
      </div>

      {/* Projects Defense List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-100">Danh sách Sinh viên bảo vệ trong Hội đồng</h3>
          <span className="text-xs text-slate-400">Trọng số tính điểm: 40% GVHD + 20% GVPB + 40% Hội đồng</span>
        </div>

        <div className="space-y-3">
          {projects.map((p, idx) => {
            const hasMyScore = !!p.my_score;
            return (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{idx + 1}.</span>
                    <span className="font-mono text-xs font-bold text-blue-400">{p.student_reg_no}</span>
                    <span className="font-bold text-sm text-slate-100">{p.student_name}</span>
                    <span className="text-xs text-slate-400">({p.student_class})</span>
                  </div>

                  <p className="text-xs text-slate-200 font-medium">{p.topic_title_vi}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span>GVHD: <b className="text-slate-300">{p.supervisor?.full_name}</b> ({p.supervisor_score !== null ? `${p.supervisor_score}đ` : 'Chưa điểm'})</span>
                    <span>GVPB: <b className="text-slate-300">{p.reviewer?.full_name}</b> ({p.reviewer_score !== null ? `${p.reviewer_score}đ` : 'Chưa điểm'})</span>
                    {p.final_grade?.final_score_10 !== null && (
                      <span className="text-amber-400 font-bold">
                        Điểm Tổng kết: {p.final_grade.final_score_10}đ ({p.final_grade.final_letter_grade})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {hasMyScore ? (
                    <div className="text-right mr-2">
                      <span className="text-xs text-slate-400">Điểm của Thầy/Cô:</span>
                      <p className="text-base font-bold text-emerald-400">{p.my_score.total_score} / 10đ</p>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-400 italic mr-2">Chưa chấm điểm</span>
                  )}

                  <button
                    onClick={() => handleOpenScoreModal(p)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      hasMyScore
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    }`}
                  >
                    {hasMyScore ? 'Sửa điểm' : '✍️ Chấm điểm bảo vệ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Live Grading Form */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-lg w-full shadow-2xl space-y-4">
            <div>
              <span className="text-xs font-mono text-blue-400">{selectedProject?.student_reg_no} - {selectedProject?.student_name}</span>
              <h3 className="text-base font-bold text-slate-100 mt-1">{selectedProject?.topic_title_vi}</h3>
            </div>

            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>1. Kỹ năng Thuyết trình & Báo cáo</span>
                    <span className="font-bold text-blue-400">{scorePres} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scorePres}
                    onChange={(e) => setScorePres(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>2. Chất lượng nội dung chuyên môn đồ án</span>
                    <span className="font-bold text-blue-400">{scoreContent} / 3.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="3.0"
                    value={scoreContent}
                    onChange={(e) => setScoreContent(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>3. Trả lời câu hỏi phản biện</span>
                    <span className="font-bold text-blue-400">{scoreQa} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreQa}
                    onChange={(e) => setScoreQa(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-medium text-slate-300 mb-1">
                    <span>4. Sản phẩm Demo / Ứng dụng thực nghiệm</span>
                    <span className="font-bold text-blue-400">{scoreDemo} / 2.0đ</span>
                  </div>
                  <input
                    type="range"
                    step="0.1"
                    min="0"
                    max="2.0"
                    value={scoreDemo}
                    onChange={(e) => setScoreDemo(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-100">Tổng điểm Hội đồng (Thang 10):</span>
                  <span className="text-xl font-extrabold text-emerald-400">{totalPreview.toFixed(1)} / 10.0</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ý kiến nhận xét & Câu hỏi cho sinh viên</label>
                <textarea
                  rows={3}
                  value={scoreComments}
                  onChange={(e) => setScoreComments(e.target.value)}
                  placeholder="Ghi nhận xét và câu hỏi của thành viên hội đồng..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận Điểm Chấm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
