import React, { useState, useEffect } from "react";
import {
  Users,
  Activity,
  Target,
  Award,
  Settings,
  Layout,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  Download,
  Bell,
  LogOut,
  Menu,
  TrendingUp,
  Calendar,
  Clock,
  MapPin,
  Eye,
} from "lucide-react";

const API_URL = "http://localhost:3000/api";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user] = useState({ name: "Admin", role: "admin" });
  
  const [heroContent, setHeroContent] = useState({
    badge: "🎉 Türkiye'nin En Büyük Spor Topluluğu",
    title: "Sporla Buluş,",
    titleHighlight: "Birlikte Hareket Et!",
    description: "Çevrende spor yapan insanları bul, takımlar oluştur, birlikte antrenman yap.",
  });

  const [features, setFeatures] = useState([
    { id: 1, title: "Yakınındaki Etkinlikler", description: "Konumuna göre etkinlikler", color: "from-purple-500 to-pink-500" },
    { id: 2, title: "Takım Oluştur", description: "Arkadaşlarınla takım kur", color: "from-blue-500 to-cyan-500" },
    { id: 3, title: "Etkinlik Planla", description: "Kendi antrenmanlarını planla", color: "from-orange-500 to-red-500" },
  ]);

  const [stats, setStats] = useState([
    { id: 1, label: "Aktif Kullanıcı", value: 2547, icon: "Users" },
    { id: 2, label: "Tamamlanan Antrenman", value: 1832, icon: "Activity" },
    { id: 3, label: "Oluşturulan Takım", value: 156, icon: "Target" },
    { id: 4, label: "Kazanılan Rozet", value: 3421, icon: "Award" },
  ]);

  const [siteSettings, setSiteSettings] = useState({
    siteName: "SporlaConnect",
    primaryColor: "#7C3AED",
    secondaryColor: "#EC4899",
    footerText: "© 2026 SporlaConnect. Tüm hakları saklıdır.",
  });

const [users, setUsers] = useState([]);

// Fetch data on component mount
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchTrainings();
    fetchTeams();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      const data = await response.json();
      setStats([
        { id: 1, label: "Aktif Kullanıcı", value: data.users, icon: "Users" },
        { id: 2, label: "Tamamlanan Antrenman", value: data.completedTrainings, icon: "Activity" },
        { id: 3, label: "Oluşturulan Takım", value: data.teams, icon: "Target" },
        { id: 4, label: "Toplam Antrenman", value: data.trainings, icon: "Award" },
      ]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      const data = await response.json();
      setUsers(data.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        trainings: u.training_count || 0,
        teams: u.team_count || 0,
      })));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchTrainings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/trainings`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      const data = await response.json();
      setTrainings(data.map(t => ({
        id: t.id,
        title: t.title,
        location: t.location,
        date: t.date?.split('T')[0] || t.date,
        time: t.time || '00:00',
        participants: t.participant_count || 0,
        maxParticipants: t.max_participants || 20,
      })));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/teams`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      const data = await response.json();
      setTeams(data.map(t => ({
        id: t.id,
        name: t.name,
        members: t.member_count || 0,
        sport: t.sport || 'Genel',
      })));
    } catch (error) {
      console.error('Error:', error);
    }
  };

const [trainings, setTrainings] = useState([]);
const [teams, setTeams] = useState([]);

  const Sidebar = () => {
    const menuItems = [
      { id: "dashboard", icon: BarChart3, label: "Dashboard" },
      { id: "content", icon: Layout, label: "İçerik Yönetimi" },
      { id: "users", icon: Users, label: "Kullanıcılar" },
      { id: "trainings", icon: Activity, label: "Antrenmanlar" },
      { id: "teams", icon: Target, label: "Takımlar" },
      { id: "settings", icon: Settings, label: "Ayarlar" },
    ];

    return (
      <div className={`${isSidebarOpen ? "w-64" : "w-20"} bg-gradient-to-b from-purple-900 to-purple-800 text-white transition-all flex flex-col`}>
        <div className="p-6 border-b border-purple-700">
          <div className="flex items-center justify-between">
            {isSidebarOpen && <span className="text-xl font-bold">Admin Panel</span>}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-purple-700 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id ? "bg-white text-purple-900" : "hover:bg-purple-700"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-purple-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="font-bold">A</span>
            </div>
            {isSidebarOpen && (
              <div className="flex-1">
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-purple-300">Administrator</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Header = () => (
    <div className="bg-white border-b px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {activeTab === "dashboard" && "Dashboard"}
          {activeTab === "content" && "İçerik Yönetimi"}
          {activeTab === "users" && "Kullanıcılar"}
          {activeTab === "trainings" && "Antrenmanlar"}
          {activeTab === "teams" && "Takımlar"}
          {activeTab === "settings" && "Ayarlar"}
        </h1>
        <p className="text-gray-600 text-sm">SporlaConnect yönetim paneli</p>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-6 h-6 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg">
          <LogOut className="w-5 h-5 text-gray-600" />
          <span className="text-gray-700">Çıkış</span>
        </button>
      </div>
    </div>
  );

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.id} className="bg-white rounded-2xl p-6 border hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                {stat.icon === "Users" && <Users className="w-6 h-6 text-white" />}
                {stat.icon === "Activity" && <Activity className="w-6 h-6 text-white" />}
                {stat.icon === "Target" && <Target className="w-6 h-6 text-white" />}
                {stat.icon === "Award" && <Award className="w-6 h-6 text-white" />}
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value.toLocaleString()}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border">
          <h3 className="text-lg font-bold mb-4">Son Kullanıcılar</h3>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="font-bold text-purple-600">{user.name[0]}</span>
                  </div>
                  <div>
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs">Aktif</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border">
          <h3 className="text-lg font-bold mb-4">Son Antrenmanlar</h3>
          <div className="space-y-3">
            {trainings.map((training) => (
              <div key={training.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{training.title}</div>
                  <div className="text-sm text-gray-500">{training.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{training.participants}/{training.maxParticipants}</div>
                  <div className="text-xs text-gray-500">Katılımcı</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  const ContentTab = () => {
    const [editingSection, setEditingSection] = useState(null);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Hero Banner</h3>
            <button
              onClick={() => setEditingSection(editingSection === "hero" ? null : "hero")}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
            >
              {editingSection === "hero" ? <X className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
              <span>{editingSection === "hero" ? "İptal" : "Düzenle"}</span>
            </button>
          </div>

          {editingSection === "hero" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Badge Metni</label>
                <input
                  type="text"
                  value={heroContent.badge}
                  onChange={(e) => setHeroContent({ ...heroContent, badge: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ana Başlık</label>
                <input
                  type="text"
                  value={heroContent.title}
                  onChange={(e) => setHeroContent({ ...heroContent, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vurgulu Başlık</label>
                <input
                  type="text"
                  value={heroContent.titleHighlight}
                  onChange={(e) => setHeroContent({ ...heroContent, titleHighlight: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Açıklama</label>
                <textarea
                  value={heroContent.description}
                  onChange={(e) => setHeroContent({ ...heroContent, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                />
              </div>
              <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2">
                <Save className="w-5 h-5" />
                <span>Kaydet</span>
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl">
              <div className="inline-block px-4 py-2 bg-white/50 rounded-full text-sm mb-4">
                {heroContent.badge}
              </div>
              <h2 className="text-3xl font-bold mb-2">
                {heroContent.title}
                <br />
                <span className="text-purple-600">{heroContent.titleHighlight}</span>
              </h2>
              <p className="text-gray-600">{heroContent.description}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Özellikler</h3>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Yeni Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature.id} className="p-4 border rounded-xl hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl`}></div>
                  <div className="flex space-x-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold mb-1">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border">
          <h3 className="text-xl font-bold mb-6">İstatistikler</h3>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div key={stat.id} className="flex items-center justify-between p-4 border rounded-xl">
                <div>
                  <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
                  <input
                    type="number"
                    value={stat.value}
                    onChange={(e) => {
                      const newStats = stats.map((s) =>
                        s.id === stat.id ? { ...s, value: parseInt(e.target.value) } : s
                      );
                      setStats(newStats);
                    }}
                    className="text-2xl font-bold w-32 px-2 py-1 border rounded"
                  />
                </div>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center space-x-1">
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const UsersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input type="text" placeholder="Kullanıcı ara..." className="pl-10 pr-4 py-2 border rounded-lg w-64" />
          </div>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filtrele</span>
          </button>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2">
          <Download className="w-5 h-5" />
          <span>Dışa Aktar</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Kullanıcı</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">E-posta</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Antrenmanlar</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Takımlar</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Durum</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-purple-600">{user.name[0]}</span>
                    </div>
                    <div className="font-semibold">{user.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{user.email}</td>
                <td className="px-6 py-4">{user.trainings}</td>
                <td className="px-6 py-4">{user.teams}</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs">Aktif</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const TrainingsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          <input type="text" placeholder="Antrenman ara..." className="pl-10 pr-4 py-2 border rounded-lg w-64" />
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Yeni Antrenman</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {trainings.map((training) => (
          <div key={training.id} className="bg-white rounded-2xl p-6 border hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{training.title}</h3>
              <div className="flex space-x-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-gray-100 rounded-lg text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                {training.location}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                {training.date}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-2" />
                {training.time}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{training.participants}/{training.maxParticipants} Katılımcı</span>
              <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs">Aktif</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const SettingsTab = () => (
    <div className="bg-white rounded-2xl p-6 border">
      <h3 className="text-xl font-bold mb-6">Genel Ayarlar</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Site Adı</label>
          <input
            type="text"
            value={siteSettings.siteName}
            onChange={(e) => setSiteSettings({ ...siteSettings, siteName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ana Renk</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={siteSettings.primaryColor}
                onChange={(e) => setSiteSettings({ ...siteSettings, primaryColor: e.target.value })}
                className="w-16 h-10 rounded border"
              />
              <input
                type="text"
                value={siteSettings.primaryColor}
                className="flex-1 px-4 py-2 border rounded-lg"
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">İkincil Renk</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={siteSettings.secondaryColor}
                onChange={(e) => setSiteSettings({ ...siteSettings, secondaryColor: e.target.value })}
                className="w-16 h-10 rounded border"
              />
              <input
                type="text"
                value={siteSettings.secondaryColor}
                className="flex-1 px-4 py-2 border rounded-lg"
                readOnly
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Footer Metni</label>
          <input
            type="text"
            value={siteSettings.footerText}
            onChange={(e) => setSiteSettings({ ...siteSettings, footerText: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2">
          <Save className="w-5 h-5" />
          <span>Ayarları Kaydet</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-8">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "content" && <ContentTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "trainings" && <TrainingsTab />}
          {activeTab === "teams" && <UsersTab />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}