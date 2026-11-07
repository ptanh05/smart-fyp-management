import re

file_path = "UTCSupervisorGraduationView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Thêm state cho batches và selectedBatch (sau dòng const [loading, setLoading])
old1 = '''  const [loading, setLoading] = useState(true);'''
new1 = '''  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | 'all'>('all');
  const [loadingBatches, setLoadingBatches] = useState(true);'''
content = content.replace(old1, new1, 1)

# 2. Thêm useEffect load batches + sửa fetchData để dùng batch filter
old2 = '''  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, revRes, outRes, defRes] = await Promise.all([
        axios.get(`${API_BASE}/supervisor/graduation-projects/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/reviewer/assigned-projects/`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/supervisor/outline-group-reviews/`, { headers: getHeaders() }).catch(() => null),
        apiService.getAdminDeferralRequests().catch(() => []),
      ]);'''
new2 = '''  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await axios.get(`${API_BASE}/supervisor/my-batches/`, { headers: getHeaders() }).catch(() => null);
      if (res?.data) {
        setBatches(res.data);
        // Auto-select batch đang mở gần nhất (nếu có)
        const activeBatch = res.data.find((b: any) => b.is_active && !b.is_closed);
        if (activeBatch) {
          setSelectedBatchId(activeBatch.id);
          localStorage.setItem('supervisor_selected_batch_id', String(activeBatch.id));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const batchParam = selectedBatchId !== 'all' ? `?batch_id=${selectedBatchId}` : '';
      const [projRes, revRes, outRes, defRes] = await Promise.all([
        axios.get(`${API_BASE}/supervisor/graduation-projects/${batchParam}`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/reviewer/assigned-projects/${batchParam}`, { headers: getHeaders() }).catch(() => null),
        axios.get(`${API_BASE}/supervisor/outline-group-reviews/${batchParam}`, { headers: getHeaders() }).catch(() => null),
        apiService.getAdminDeferralRequests().catch(() => []),
      ]);'''
content = content.replace(old2, new2, 1)

# 3. Sửa useEffect để gọi fetchBatches và fetchData khi selectedBatchId thay đổi
old3 = '''  useEffect(() => {
    fetchData();
  }, []);'''
new3 = '''  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBatchId]);'''
content = content.replace(old3, new3, 1)

# 4. Thêm batch selector UI (trước Navigation Tabs)
old4 = '''  return (
    <div className="space-y-6">
      {/* Navigation Tabs (Aligned with 6 UTC Stages + Student Counts) */}'''
new4 = '''  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Batch Selector - Responsive + Animation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl p-4 shadow-lg animate-slideDown">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📅</span>
          <div>
            <h4 className="text-sm font-bold text-slate-100">Đợt Đồ Án</h4>
            <p className="text-xs text-slate-400">Chọn đợt để xem sinh viên</p>
          </div>
        </div>
        <select
          value={selectedBatchId}
          onChange={(e) => {
            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
            setSelectedBatchId(val);
            if (val !== 'all') {
              localStorage.setItem('supervisor_selected_batch_id', String(val));
            }
          }}
          disabled={loadingBatches}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          <option value="all">🌐 Tất cả các đợt</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.is_active && !batch.is_closed ? '🟢' : '⚫'} {batch.batch_code} - {batch.batch_name}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation Tabs (Aligned with 6 UTC Stages + Student Counts) */}'''
content = content.replace(old4, new4, 1)

# 5. Thêm responsive + animations cho tabs
old5 = '''      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">'''
new5 = '''      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3 animate-fadeInUp">'''
content = content.replace(old5, new5, 1)

# 6. Thêm animation cho tab buttons
old6 = '''            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}'''
new6 = '''            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 transform hover:scale-105 active:scale-95 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 animate-pulse-slow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:shadow-md'
            }`}'''
content = content.replace(old6, new6, 1)

# 7. Thêm animation cho các tab content (Tab 1)
old7 = '''      {activeTab === 'students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">'''
new7 = '''      {activeTab === 'students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5 shadow-xl animate-fadeInUp hover:shadow-2xl transition-shadow duration-300">'''
content = content.replace(old7, new7, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Đã sửa UTCSupervisorGraduationView.tsx thành công!")
print("   - Thêm state batches + selectedBatchId")
print("   - Thêm fetchBatches() + useEffect")
print("   - Thêm batch filter vào fetchData()")
print("   - Thêm Batch Selector UI với responsive + animations")
print("   - Thêm animations cho tabs và content")
