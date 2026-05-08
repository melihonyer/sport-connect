import React, { useState, useEffect } from "react";
import {
  MapPin,
  Users,
  Calendar,
  Clock,
  Bell,
  Plus,
  X,
  Heart,
  TrendingUp,
  Award,
  Activity,
  Target,
  LogOut,
  ArrowLeft,
  Lock,
  Edit,
  Trash2,
  Send,
  Search,
  UserPlus,
  MessageCircle,
  Settings,
  ChevronDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL = "http://localhost:3000/api";

export default function SporlaConnect() {
  const [currentPage, setCurrentPage] = useState("home");
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [trainings, setTrainings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myTrainings, setMyTrainings] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const stats = [
    { icon: Users, label: "Aktif Kullanıcı", value: "2,547" },
    { icon: Activity, label: "Tamamlanan Antrenman", value: "1,832" },
    { icon: Target, label: "Oluşturulan Takım", value: "156" },
    { icon: Award, label: "Kazanılan Rozet", value: "3,421" },
  ];

  const features = [
    {
      icon: MapPin,
      title: "Yakınındaki Etkinlikler",
      description: "Konumuna göre etkinlikler",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Users,
      title: "Takım Oluştur",
      description: "Arkadaşlarınla takım kur",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Calendar,
      title: "Etkinlik Planla",
      description: "Kendi antrenmanlarını planla",
      color: "from-orange-500 to-red-500",
    },
    {
      icon: Award,
      title: "Rozetler Kazan",
      description: "Hedeflerini tamamla",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: TrendingUp,
      title: "İlerlemeyi Takip Et",
      description: "Performansını analiz et",
      color: "from-indigo-500 to-purple-500",
    },
    {
      icon: Heart,
      title: "Topluluk Desteği",
      description: "Birlikte spor yap",
      color: "from-pink-500 to-rose-500",
    },
  ];

  const sportTypes = [
    "Koşu",
    "Bisiklet",
    "Yüzme",
    "Yoga",
    "Pilates",
    "Futbol",
    "Basketbol",
    "Voleybol",
    "Tenis",
    "Triatlon",
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserData(token);
    }
    fetchTrainings();
    fetchTeams();
    fetchBadges();
  }, []);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        fetchMyTrainings(token);
        fetchMyTeams(token);
        fetchNotifications(token);
        fetchUserStats(token, data.user.id);
        fetchUserBadges(token, data.user.id);
        fetchUserActivity(token, data.user.id);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setIsAuthModalOpen(false);
        fetchUserData(data.token);
        fetchTrainings();
        fetchTeams();
      } else {
        alert("Giriş başarısız!");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Bir hata oluştu!");
    }
  };

  const handleRegister = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setIsAuthModalOpen(false);
        fetchUserData(data.token);
        fetchTrainings();
        fetchTeams();
      } else {
        alert("Kayıt başarısız!");
      }
    } catch (error) {
      console.error("Register error:", error);
      alert("Bir hata oluştu!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setMyTrainings([]);
    setMyTeams([]);
    setNotifications([]);
    setUserBadges([]);
    setUserStats(null);
    setActivityData([]);
    setCurrentPage("home");
  };

  const handleUpdateProfile = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setShowProfileEdit(false);
        alert("Profil güncellendi!");
      }
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  const fetchTrainings = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/trainings`, { headers });

      if (response.ok) {
        const data = await response.json();
        setTrainings(data.trainings || []);
      }
    } catch (error) {
      console.error("Fetch trainings error:", error);
    }
  };

  const fetchMyTrainings = async (token) => {
    try {
      const response = await fetch(`${API_URL}/trainings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMyTrainings(data.trainings || []);
      }
    } catch (error) {
      console.error("Fetch my trainings error:", error);
    }
  };

  const fetchTrainingDetails = async (trainingId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTraining(data.training);
        setCurrentPage("training-detail");
      }
    } catch (error) {
      console.error("Fetch training details error:", error);
    }
  };

  const handleJoinTraining = async (trainingId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthMode("login");
        setIsAuthModalOpen(true);
        return;
      }

      const response = await fetch(`${API_URL}/trainings/${trainingId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert("Katılım başarılı!");
        fetchTrainings();
        fetchMyTrainings(token);
        if (selectedTraining?.id === trainingId) {
          fetchTrainingDetails(trainingId);
        }
      } else {
        const data = await response.json();
        alert(data.error || "Katılım başarısız!");
      }
    } catch (error) {
      console.error("Join training error:", error);
    }
  };

  const handleCreateTraining = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Antrenman oluşturuldu!");
        setCurrentPage("profile");
        fetchTrainings();
        fetchMyTrainings(token);
      } else {
        const data = await response.json();
        alert(data.error || "Oluşturulamadı!");
      }
    } catch (error) {
      console.error("Create training error:", error);
    }
  };

  const handleDeleteTraining = async (trainingId) => {
    if (!confirm("Silmek istediğinize emin misiniz?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert("Silindi!");
        setCurrentPage("profile");
        fetchTrainings();
        fetchMyTrainings(token);
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleAddComment = async (trainingId, comment) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/trainings/${trainingId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
      });
      fetchTrainingDetails(trainingId);
    } catch (error) {
      console.error("Add comment error:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/teams`, { headers });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error("Fetch teams error:", error);
    }
  };

  const fetchMyTeams = async (token) => {
    try {
      const response = await fetch(`${API_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMyTeams(data.teams || []);
      }
    } catch (error) {
      console.error("Fetch my teams error:", error);
    }
  };

  const fetchTeamDetails = async (teamId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTeam(data.team);
        setCurrentPage("team-detail");
      } else {
        alert("Takım detaylarına erişim yok!");
      }
    } catch (error) {
      console.error("Fetch team details error:", error);
    }
  };

  const handleJoinTeam = async (teamId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthMode("login");
        setIsAuthModalOpen(true);
        return;
      }

      const response = await fetch(`${API_URL}/teams/${teamId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert("Takıma katıldınız!");
        fetchTeams();
        fetchMyTeams(token);
        if (selectedTeam?.id === teamId) {
          fetchTeamDetails(teamId);
        }
      } else {
        const data = await response.json();
        alert(data.error || "Katılım başarısız!");
      }
    } catch (error) {
      console.error("Join team error:", error);
    }
  };

  const handleCreateTeam = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Takım oluşturuldu!");
        setCurrentPage("profile");
        fetchTeams();
        fetchMyTeams(token);
      }
    } catch (error) {
      console.error("Create team error:", error);
    }
  };

  const handleInviteToTeam = async (teamId, email) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/teams/${teamId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        alert("Davet gönderildi!");
        setShowInviteModal(false);
      }
    } catch (error) {
      console.error("Invite error:", error);
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!confirm("Üyeyi çıkarmak istediğinize emin misiniz?")) return;

    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Üye çıkarıldı!");
      fetchTeamDetails(teamId);
    } catch (error) {
      console.error("Remove member error:", error);
    }
  };

  const handleAddTeamPost = async (teamId, message) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/teams/${teamId}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      fetchTeamDetails(teamId);
    } catch (error) {
      console.error("Add post error:", error);
    }
  };

  const fetchNotifications = async (token) => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Fetch notifications error:", error);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications(token);
    } catch (error) {
      console.error("Mark notification error:", error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications(token);
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await fetch(`${API_URL}/badges`);
      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
      }
    } catch (error) {
      console.error("Fetch badges error:", error);
    }
  };

  const fetchUserBadges = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserBadges(data.stats.badges || []);
      }
    } catch (error) {
      console.error("Fetch user badges error:", error);
    }
  };

  const fetchUserStats = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error("Fetch user stats error:", error);
    }
  };

  const fetchUserActivity = async (token, userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setActivityData(data.activity);
      }
    } catch (error) {
      console.error("Fetch activity error:", error);
    }
  };
  // =====================================================
  // COMPONENTS
  // =====================================================

  const HeroSection = () => (
    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
            🎉 Türkiye'nin En Büyük Spor Topluluğu
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Sporla Buluş,
            <br />
            <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              Birlikte Hareket Et!
            </span>
          </h1>

          <p className="text-xl text-white/90 max-w-2xl">
            Çevrende spor yapan insanları bul, takımlar oluştur, birlikte antrenman yap.
          </p>

          <div className="flex flex-wrap gap-4">
            {!user ? (
              <>
                <button
                  onClick={() => {
                    setAuthMode("register");
                    setIsAuthModalOpen(true);
                  }}
                  className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
                >
                  Hemen Başla
                </button>
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthModalOpen(true);
                  }}
                  className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-full font-semibold hover:bg-white/20 transition-all"
                >
                  Giriş Yap
                </button>
              </>
            ) : (
              <button
                onClick={() => setCurrentPage("trainings")}
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
              >
                Antrenmanları Keşfet
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-8 pt-8">
            {stats.slice(0, 3).map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto">
          <path
            fill="#ffffff"
            d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
          ></path>
        </svg>
      </div>
    </div>
  );

  const FeaturesSection = () => (
    <div className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Neden SporlaConnect?</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Spor yapmayı seven insanları bir araya getiren platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 bg-white rounded-2xl border border-gray-100 hover:shadow-2xl transition-all"
            >
              <div
                className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
              >
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const TrainingCard = ({ training, onClick }) => {
  const progress = training.attendee_count
    ? (training.attendee_count / training.capacity) * 100
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-2xl transition-all overflow-hidden group">
      <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500"></div>
      <div className="p-6 cursor-pointer" onClick={() => onClick(training.id)}>
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
            {training.team_sport || "Genel"}
          </span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-sm font-medium">
            {training.difficulty || "Orta"}
          </span>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{training.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{training.description}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600 text-sm">
            <MapPin className="w-4 h-4 mr-2" />
            {training.location_name}
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Calendar className="w-4 h-4 mr-2" />
            {new Date(training.training_date).toLocaleDateString("tr-TR")}
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Clock className="w-4 h-4 mr-2" />
            {training.training_time}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Katılımcılar</span>
            <span className="font-semibold">
              {training.attendee_count || 0}/{training.capacity}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleJoinTraining(training.id);
          }}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Katıl
        </button>
      </div>
    </div>
  );
};

  <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(training.id);
            }}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg text-sm mt-2"
          >
            Detayları Gör
          </button>

  const TeamCard = ({ team, onClick }) => (
    <div
      onClick={() => onClick(team.id)}
      className="bg-white rounded-2xl border p-6 hover:shadow-2xl transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold">{team.name}</h3>
        {!team.is_public && <Lock className="w-5 h-5 text-gray-400" />}
      </div>
      <p className="text-gray-600 mb-4 line-clamp-2">{team.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 flex items-center">
          <Users className="w-4 h-4 mr-1" />
          {team.member_count || 0} üye
        </span>
        <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">
          {team.sport}
        </span>
      </div>
    </div>
  );

  const BadgeCard = ({ badge, earned }) => (
    <div
      className={`p-6 rounded-2xl border-2 ${
        earned ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="text-center mb-4">
        <div className={`text-6xl mb-2 ${earned ? "" : "grayscale opacity-50"}`}>
          {badge.icon}
        </div>
        <h3 className="font-bold text-lg">{badge.name}</h3>
        <p className="text-sm text-gray-600">{badge.description}</p>
      </div>
      {earned && badge.earned_at && (
        <div className="text-xs text-center text-gray-500">
          {new Date(badge.earned_at).toLocaleDateString("tr-TR")}
        </div>
      )}
    </div>
  );

  // =====================================================
  // PAGES
  // =====================================================

  const HomePage = () => (
    <>
      <HeroSection />
      <FeaturesSection />
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-4xl font-bold">Yaklaşan Antrenmanlar</h2>
            <button
              onClick={() => setCurrentPage("trainings")}
              className="text-purple-600 hover:underline flex items-center"
            >
              Tümünü Gör <ChevronDown className="w-5 h-5 ml-1 rotate-[-90deg]" />
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {trainings.slice(0, 6).map((training) => (
              <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const ProfilePage = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl p-8 border">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user?.avatar || user?.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{user?.name}</h1>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => setShowProfileEdit(true)}
            className="px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Ayarlar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-purple-50 rounded-xl">
            <div className="text-3xl font-bold text-purple-600">
              {userStats?.total_trainings || 0}
            </div>
            <div className="text-sm text-gray-600">Antrenman</div>
          </div>
          <div className="p-4 bg-pink-50 rounded-xl">
            <div className="text-3xl font-bold text-pink-600">{myTeams.length}</div>
            <div className="text-sm text-gray-600">Takım</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="text-3xl font-bold text-blue-600">{userBadges.length}</div>
            <div className="text-sm text-gray-600">Rozet</div>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="text-3xl font-bold text-green-600">
              {userStats?.total_distance || 0} km
            </div>
            <div className="text-sm text-gray-600">Mesafe</div>
          </div>
        </div>

        {/* ACTIVITY CHART - YENİ! */}
        {activityData.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              📊 Haftalık Aktivite
            </h3>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    cursor={{ fill: 'rgba(147, 51, 234, 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#colorGradient)" 
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9333ea" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-sm text-gray-500 text-center mt-4">
                Son 7 günlük antrenman aktivitesi
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <button
            onClick={() => setCurrentPage("create-training")}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Antrenman Oluştur</span>
          </button>
          <button
            onClick={() => setCurrentPage("create-team")}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Takım Oluştur</span>
          </button>
          <button
            onClick={() => setCurrentPage("badges")}
            className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg flex items-center justify-center space-x-2"
          >
            <Award className="w-5 h-5" />
            <span>Rozetlerim</span>
          </button>
        </div>

        {myTrainings.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">Antrenmanlarım</h3>
            <div className="space-y-4">
              {myTrainings.slice(0, 5).map((training) => (
                <div
                  key={training.id}
                  onClick={() => fetchTrainingDetails(training.id)}
                  className="p-4 border rounded-xl hover:shadow-lg transition-all cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold">{training.title}</h4>
                    <p className="text-sm text-gray-600">{training.location_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(training.training_date).toLocaleDateString("tr-TR")} -{" "}
                      {training.training_time}
                    </p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400 rotate-[-90deg]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {myTeams.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">Takımlarım</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {myTeams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => fetchTeamDetails(team.id)}
                  className="p-4 border rounded-xl hover:shadow-lg transition-all cursor-pointer"
                >
                  <h4 className="font-bold">{team.name}</h4>
                  <p className="text-sm text-gray-600">{team.sport}</p>
                  <p className="text-xs text-gray-500 mt-1">{team.member_count} üye</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const TrainingsPage = () => (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Antrenmanlar</h1>
        {user && (
          <button
            onClick={() => setCurrentPage("create-training")}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Oluştur
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {trainings.map((training) => (
          <TrainingCard key={training.id} training={training} onClick={fetchTrainingDetails} />
        ))}
      </div>

      {trainings.length === 0 && (
        <div className="text-center py-20">
          <Activity className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Henüz antrenman yok</p>
        </div>
      )}
    </div>
  );

  const TeamsPage = () => (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Takımlar</h1>
        {user && (
          <button
            onClick={() => setCurrentPage("create-team")}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Takım
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} onClick={fetchTeamDetails} />
        ))}
      </div>

      {teams.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Henüz takım yok</p>
        </div>
      )}
    </div>
  );

  const BadgesPage = () => (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <button
        onClick={() => setCurrentPage("profile")}
        className="flex items-center text-purple-600 mb-6 hover:underline"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Geri Dön
      </button>

      <h1 className="text-4xl font-bold mb-8">Rozetler</h1>

      <div className="bg-white p-6 rounded-2xl border mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {userBadges.length} / {badges.length} Rozet
            </h2>
            <p className="text-gray-600">Kazandığın rozetler</p>
          </div>
          <div className="text-6xl">🏆</div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {badges.map((badge) => {
          const earned = userBadges.find((ub) => ub.id === badge.id);
          return <BadgeCard key={badge.id} badge={earned || badge} earned={!!earned} />;
        })}
      </div>
    </div>
  );
  const TrainingDetailPage = () => {
    if (!selectedTraining) return null;

    const isMyTraining = myTeams.some((team) => team.id === selectedTraining.team_id);
    const isOwner = user && selectedTraining.team_owner_id === user.id;
    const [comment, setComment] = useState("");

    const handleSubmitComment = (e) => {
      e.preventDefault();
      if (comment.trim()) {
        handleAddComment(selectedTraining.id, comment);
        setComment("");
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => setCurrentPage("trainings")}
          className="flex items-center text-purple-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Geri Dön
        </button>

        <div className="bg-white rounded-2xl p-8 border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{selectedTraining.title}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                {selectedTraining.team_sport || "Genel"}
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-sm font-medium">
                {selectedTraining.difficulty}
              </span>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => handleDeleteTraining(selectedTraining.id)}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-semibold hover:bg-red-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sil
              </button>
            </div>
          )}

          <p className="text-gray-600 mb-6">{selectedTraining.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-semibold">Konum</span>
              </div>
              <p>{selectedTraining.location_name}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-semibold">Tarih</span>
              </div>
              <p>{new Date(selectedTraining.training_date).toLocaleDateString("tr-TR")}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-semibold">Saat</span>
              </div>
              <p>{selectedTraining.training_time}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Users className="w-5 h-5 mr-2" />
                <span className="font-semibold">Kapasite</span>
              </div>
              <p>
                {selectedTraining.attendees?.length || 0}/{selectedTraining.capacity}
              </p>
            </div>
          </div>

          {isMyTraining && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Katılımcılar</h3>
              {selectedTraining.attendees && selectedTraining.attendees.length > 0 ? (
                <div className="space-y-2">
                  {selectedTraining.attendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {attendee.avatar || attendee.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{attendee.name}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(attendee.joined_at).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Henüz katılımcı yok</p>
              )}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              Yorumlar ({selectedTraining.comments?.length || 0})
            </h3>

            {user && (
              <form onSubmit={handleSubmitComment} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Yorum yaz..."
                    className="flex-1 px-4 py-2 border rounded-xl"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}

            {selectedTraining.comments && selectedTraining.comments.length > 0 ? (
              <div className="space-y-3">
                {selectedTraining.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold mr-2">
                        {c.user_avatar || c.user_name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{c.user_name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(c.created_at).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700">{c.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Henüz yorum yok</p>
            )}
          </div>

          {!isMyTraining && (
            <button
              onClick={() => handleJoinTraining(selectedTraining.id)}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg"
            >
              Katıl
            </button>
          )}
        </div>
      </div>
    );
  };

  const TeamDetailPage = () => {
    if (!selectedTeam) return null;

    const isMyTeam = user && selectedTeam.owner_id === user.id;
    const isMember = selectedTeam.members?.some((member) => member.id === user?.id);
    const canSeeMembers = !selectedTeam.is_private || isMyTeam || isMember;
    const [message, setMessage] = useState("");

    const handleSubmitPost = (e) => {
      e.preventDefault();
      if (message.trim()) {
        handleAddTeamPost(selectedTeam.id, message);
        setMessage("");
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => setCurrentPage("teams")}
          className="flex items-center text-purple-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Geri Dön
        </button>

        <div className="bg-white rounded-2xl p-8 border">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{selectedTeam.name}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                {selectedTeam.sport}
              </span>
              {selectedTeam.is_private && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  Gizli
                </span>
              )}
            </div>
          </div>

          {isMyTeam && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setSelectedTeam(selectedTeam);
                  setShowInviteModal(true);
                }}
                className="px-4 py-2 bg-green-100 text-green-600 rounded-xl font-semibold hover:bg-green-200 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Davet Et
              </button>
            </div>
          )}

          <p className="text-gray-600 mb-6">{selectedTeam.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-semibold">Konum</span>
              </div>
              <p>{selectedTeam.location || "Belirtilmemiş"}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center text-gray-600 mb-2">
                <Users className="w-5 h-5 mr-2" />
                <span className="font-semibold">Üye Sayısı</span>
              </div>
              <p>{selectedTeam.members?.length || 0}</p>
            </div>
          </div>

          {canSeeMembers ? (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Üyeler</h3>
              {selectedTeam.members && selectedTeam.members.length > 0 ? (
                <div className="space-y-2">
                  {selectedTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                          {member.avatar || member.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">{member.name}</div>
                          <div className="text-sm text-gray-600 capitalize">{member.role}</div>
                        </div>
                      </div>
                      {isMyTeam && member.id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                        >
                          Çıkar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Henüz üye yok</p>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl text-center">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">
                Bu gizli bir grup. Üyeleri görmek için katılmanız gerekiyor.
              </p>
            </div>
          )}

          {isMember && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Takım Duvarı</h3>

              <form onSubmit={handleSubmitPost} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Bir şeyler paylaş..."
                    className="flex-1 px-4 py-2 border rounded-xl"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {selectedTeam.posts && selectedTeam.posts.length > 0 ? (
                <div className="space-y-3">
                  {selectedTeam.posts.map((post) => (
                    <div key={post.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold mr-2">
                          {post.user_avatar || post.user_name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{post.user_name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(post.created_at).toLocaleDateString("tr-TR")}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700">{post.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Henüz mesaj yok</p>
              )}
            </div>
          )}

          {!isMember && !isMyTeam && (
            <button
              onClick={() => handleJoinTeam(selectedTeam.id)}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg"
            >
              Takıma Katıl
            </button>
          )}

          {isMember && !isMyTeam && (
            <button
              onClick={() => handleRemoveMember(selectedTeam.id, user.id)}
              className="w-full py-4 bg-red-100 text-red-600 rounded-xl font-semibold hover:bg-red-200"
            >
              Takımdan Ayrıl
            </button>
          )}
        </div>
      </div>
    );
  };

  const CreateTrainingPage = () => {
    const [formData, setFormData] = useState({
      title: "",
      description: "",
      training_date: "",
      training_time: "",
      location_name: "",
      capacity: 20,
      difficulty: "Orta",
      team_id: myTeams.length > 0 ? myTeams[0].id : null,
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleCreateTraining(formData);
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-8 border">
          <h1 className="text-3xl font-bold mb-6">Yeni Antrenman Oluştur</h1>

          {myTeams.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800">⚠️ Önce bir takım oluşturmalısınız!</p>
              <button
                onClick={() => setCurrentPage("create-team")}
                className="mt-2 text-purple-600 font-semibold"
              >
                Takım Oluştur →
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {myTeams.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Takım</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                >
                  {myTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Başlık</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Açıklama</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tarih</label>
                <input
                  type="date"
                  value={formData.training_date}
                  onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Saat</label>
                <input
                  type="time"
                  value={formData.training_time}
                  onChange={(e) => setFormData({ ...formData, training_time: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Konum</label>
              <input
                type="text"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="Örn: Kordon Boyu"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kapasite</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border rounded-xl"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Seviye</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl"
                >
                  <option value="Kolay">Kolay</option>
                  <option value="Orta">Orta</option>
                  <option value="Zor">Zor</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={myTeams.length === 0}
                className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50"
              >
                Antrenman Oluştur
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage("profile")}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const CreateTeamPage = () => {
    const [formData, setFormData] = useState({
      name: "",
      sport: "",
      description: "",
      location: "",
      is_private: false,
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleCreateTeam(formData);
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-8 border">
          <h1 className="text-3xl font-bold mb-6">Yeni Takım Oluştur</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Takım Adı</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Spor</label>
              <select
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              >
                <option value="">Seçin</option>
                {sportTypes.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Açıklama</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Konum</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="Örn: İzmir"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_private}
                onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Özel Takım (Sadece davet ile)</label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg"
              >
                Takım Oluştur
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage("profile")}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // =====================================================
  // MODALS
  // =====================================================

  const AuthModal = () => {
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (authMode === "login") {
        handleLogin(formData.email, formData.password);
      } else {
        handleRegister(formData.name, formData.email, formData.password);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold mb-6 text-center">
            {authMode === "login" ? "Giriş Yap" : "Kaydol"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === "register" && (
              <input
                type="text"
                placeholder="Ad Soyad"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                required
              />
            )}
            <input
              type="email"
              placeholder="E-posta"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl"
              required
            />
            <input
              type="password"
              placeholder="Şifre"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl"
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
            >
              {authMode === "login" ? "Giriş Yap" : "Kaydol"}
            </button>
          </form>

          <button
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            className="w-full mt-4 text-purple-600"
          >
            {authMode === "login" ? "Hesabın yok mu? Kaydol" : "Giriş yap"}
          </button>
        </div>
      </div>
    );
  };

  const NotificationsPanel = () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
      <div className="fixed right-4 top-20 w-96 bg-white rounded-2xl shadow-2xl border z-50 max-h-[600px] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">
            Bildirimler {unreadCount > 0 && `(${unreadCount})`}
          </h3>
          <button onClick={() => setShowNotifications(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 ${!notif.is_read ? "bg-blue-50" : ""}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{notif.title}</h4>
                    <button
                      onClick={() => handleDeleteNotification(notif.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {new Date(notif.created_at).toLocaleDateString("tr-TR")}
                    </span>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkNotificationRead(notif.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Okundu işaretle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Bildirim yok</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ProfileEditModal = () => {
    const [formData, setFormData] = useState({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleUpdateProfile(formData);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setShowProfileEdit(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold mb-6">Profili Düzenle</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">İsim</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Avatar (Emoji)</label>
              <input
                type="text"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="👤"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
            >
              Kaydet
            </button>
          </form>
        </div>
      </div>
    );
  };

  const InviteModal = () => {
    const [email, setEmail] = useState("");

    const handleSubmit = (e) => {
      e.preventDefault();
      if (selectedTeam && email) {
        handleInviteToTeam(selectedTeam.id, email);
        setEmail("");
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 relative m-4">
          <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold mb-6">Takıma Davet Et</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="ornek@email.com"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold"
            >
              Davet Gönder
            </button>
          </form>
        </div>
      </div>
    );
  };

  // =====================================================
  // NAVIGATION
  // =====================================================

  const Navigation = () => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentPage("home")}>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mr-3">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                SporlaConnect
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => setCurrentPage("home")}
                className="font-medium text-gray-600 hover:text-purple-600"
              >
                Ana Sayfa
              </button>
              <button
                onClick={() => setCurrentPage("trainings")}
                className="font-medium text-gray-600 hover:text-purple-600"
              >
                Antrenmanlar
              </button>
              <button
                onClick={() => setCurrentPage("teams")}
                className="font-medium text-gray-600 hover:text-purple-600"
              >
                Takımlar
              </button>

              {user ? (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentPage("create-training")}
                    className="px-4 py-2 bg-purple-100 text-purple-600 rounded-full font-semibold hover:bg-purple-200 flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Antrenman</span>
                  </button>

                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 hover:bg-gray-100 rounded-full"
                  >
                    <Bell className="w-6 h-6 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button onClick={() => setCurrentPage("profile")} className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.avatar || user.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </button>

                  <button onClick={handleLogout} className="text-gray-600 hover:text-red-600">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setIsAuthModalOpen(true);
                    }}
                    className="px-6 py-2 text-purple-600 font-semibold"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("register");
                      setIsAuthModalOpen(true);
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold"
                  >
                    Kaydol
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {currentPage === "home" && <HomePage />}
      {currentPage === "profile" && <ProfilePage />}
      {currentPage === "trainings" && <TrainingsPage />}
      {currentPage === "teams" && <TeamsPage />}
      {currentPage === "badges" && <BadgesPage />}
      {currentPage === "training-detail" && <TrainingDetailPage />}
      {currentPage === "team-detail" && <TeamDetailPage />}
      {currentPage === "create-training" && <CreateTrainingPage />}
      {currentPage === "create-team" && <CreateTeamPage />}

      {isAuthModalOpen && <AuthModal />}
      {showNotifications && <NotificationsPanel />}
      {showProfileEdit && <ProfileEditModal />}
      {showInviteModal && <InviteModal />}
    </div>
  );
}