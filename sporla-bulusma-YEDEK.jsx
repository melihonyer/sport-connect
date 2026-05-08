import React, { useState, useEffect } from 'react';
import { MapPin, Users, Calendar, Clock, Search, Bell, Plus, X, ChevronRight, Heart, Star, CreditCard, Check, AlertCircle, Menu, LogOut, Settings } from 'lucide-react';

// Simulated backend data store
const useBackend = () => {
  const [users, setUsers] = useState([
    { id: 1, name: 'Ahmet Yılmaz', email: 'ahmet@email.com', password: 'demo123', avatar: '🏃' },
    { id: 2, name: 'Ayşe Kaya', email: 'ayse@email.com', password: 'demo123', avatar: '🚴' },
  ]);
  
  const [teams, setTeams] = useState([
    {
      id: 1,
      name: 'İzmir Sabah Koşucuları',
      sport: 'Koşu',
      description: 'Her sabah 06:30\'da Kordon\'da koşuyoruz!',
      isPrivate: false,
      ownerId: 1,
      members: [1, 2],
      subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      avatar: '🏃‍♂️',
      location: 'İzmir Kordon'
    },
    {
      id: 2,
      name: 'Bisiklet Tutkuları',
      sport: 'Bisiklet',
      description: 'Hafta sonu uzun mesafe turları',
      isPrivate: true,
      ownerId: 2,
      members: [2],
      subscriptionEnd: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      avatar: '🚴',
      location: 'Karşıyaka'
    }
  ]);
  
  const [trainings, setTrainings] = useState([
    {
      id: 1,
      teamId: 1,
      title: 'Sabah Tempolu Koşu',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      time: '06:30',
      duration: 60,
      location: { name: 'Kordon Boyu', lat: 38.4192, lng: 27.1287 },
      capacity: 20,
      attendees: [1, 2],
      isPublic: true,
      description: '10 km tempo koşusu'
    },
    {
      id: 2,
      teamId: 1,
      title: 'Hafta Sonu Uzun Koşu',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      time: '07:00',
      duration: 90,
      location: { name: 'İnciraltı Kent Ormanı', lat: 38.4567, lng: 27.0456 },
      capacity: 15,
      attendees: [1],
      isPublic: true,
      description: '15 km orman parkuru'
    }
  ]);
  
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Yeni antrenman eklendi: Sabah Tempolu Koşu', time: new Date(), read: false },
  ]);
  
  return {
    users, setUsers,
    teams, setTeams,
    trainings, setTrainings,
    notifications, setNotifications
  };
};

const SporlaApp = () => {
  const backend = useBackend();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateTraining, setShowCreateTraining] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // Login Component
  const LoginView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    
    const handleLogin = () => {
      const user = backend.users.find(u => u.email === email && u.password === password);
      if (user) {
        setCurrentUser(user);
        setCurrentView('home');
      } else {
        alert('Hatalı giriş bilgileri!');
      }
    };
    
    const handleRegister = () => {
      const newUser = {
        id: backend.users.length + 1,
        name,
        email,
        password,
        avatar: '👤'
      };
      backend.setUsers([...backend.users, newUser]);
      setCurrentUser(newUser);
      setCurrentView('home');
    };
    
    return (
      <div className="login-container">
        <div className="login-hero">
          <div className="hero-content">
            <h1 className="app-logo">
              <span className="logo-icon">⚡</span>
              SporlaConnect
            </h1>
            <p className="hero-tagline">Spor arkadaşlarını bul, antrenmanlara katıl, hedeflerine ulaş</p>
          </div>
        </div>
        
        <div className="login-box">
          <div className="login-tabs">
            <button 
              className={!isRegister ? 'tab active' : 'tab'}
              onClick={() => setIsRegister(false)}
            >
              Giriş Yap
            </button>
            <button 
              className={isRegister ? 'tab active' : 'tab'}
              onClick={() => setIsRegister(true)}
            >
              Kayıt Ol
            </button>
          </div>
          
          <div className="login-form">
            {isRegister && (
              <input
                type="text"
                placeholder="Ad Soyad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            )}
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            
            <button 
              className="btn-primary"
              onClick={isRegister ? handleRegister : handleLogin}
            >
              {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
            </button>
            
            <p className="demo-info">
              Demo: ahmet@email.com / demo123
            </p>
          </div>
        </div>
      </div>
    );
  };
  
  // Home/Dashboard View
  const HomeView = () => {
    const myTeams = backend.teams.filter(t => t.members.includes(currentUser.id));
    const publicTrainings = backend.trainings.filter(t => t.isPublic);
    
    return (
      <div className="home-view">
        <section className="hero-section">
          <h1>Merhaba {currentUser.name}! 👋</h1>
          <p>Bugün hangi antrenmana katılmak istersin?</p>
        </section>
        
        <section className="quick-stats">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{myTeams.length}</div>
            <div className="stat-label">Takımım</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏃</div>
            <div className="stat-value">{publicTrainings.length}</div>
            <div className="stat-label">Açık Antrenman</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">
              {backend.trainings.filter(t => t.attendees.includes(currentUser.id)).length}
            </div>
            <div className="stat-label">Katıldığım</div>
          </div>
        </section>
        
        <section className="section">
          <div className="section-header">
            <h2>Yakındaki Açık Antrenmanlar</h2>
            <button className="btn-text" onClick={() => setCurrentView('explore')}>
              Tümünü Gör <ChevronRight size={16} />
            </button>
          </div>
          <div className="trainings-grid">
            {publicTrainings.slice(0, 3).map(training => {
              const team = backend.teams.find(t => t.id === training.teamId);
              return (
                <div 
                  key={training.id} 
                  className="training-card"
                  onClick={() => {
                    setSelectedTraining(training);
                    setCurrentView('training-detail');
                  }}
                >
                  <div className="training-header">
                    <span className="team-avatar">{team.avatar}</span>
                    <div>
                      <h3>{training.title}</h3>
                      <p className="team-name">{team.name}</p>
                    </div>
                  </div>
                  <div className="training-info">
                    <div className="info-item">
                      <Calendar size={14} />
                      <span>{training.date.toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={14} />
                      <span>{training.time}</span>
                    </div>
                    <div className="info-item">
                      <MapPin size={14} />
                      <span>{training.location.name}</span>
                    </div>
                    <div className="info-item">
                      <Users size={14} />
                      <span>{training.attendees.length}/{training.capacity}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        
        <section className="section">
          <div className="section-header">
            <h2>Takımlarım</h2>
            <button className="btn-primary-small" onClick={() => setShowCreateTeam(true)}>
              <Plus size={16} /> Yeni Takım
            </button>
          </div>
          <div className="teams-grid">
            {myTeams.map(team => (
              <div 
                key={team.id} 
                className="team-card"
                onClick={() => {
                  setSelectedTeam(team);
                  setCurrentView('team-detail');
                }}
              >
                <div className="team-avatar-large">{team.avatar}</div>
                <h3>{team.name}</h3>
                <p className="team-sport">{team.sport}</p>
                <p className="team-location">📍 {team.location}</p>
                <div className="team-stats">
                  <span>{team.members.length} üye</span>
                  <span>{team.isPrivate ? '🔒 Özel' : '🌐 Açık'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        <button className="fab" onClick={() => setShowCreateTraining(true)}>
          <Plus size={24} />
        </button>
      </div>
    );
  };
  
  // Explore View
  const ExploreView = () => {
    const publicTrainings = backend.trainings.filter(t => 
      t.isPublic && 
      (searchQuery === '' || 
       t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       backend.teams.find(team => team.id === t.teamId)?.sport.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    return (
      <div className="explore-view">
        <div className="explore-header">
          <h1>Antrenman Keşfet</h1>
          <div className="search-bar">
            <Search size={20} />
            <input
              type="text"
              placeholder="Spor dalı veya antrenman ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="map-container">
          <div className="map-placeholder">
            <MapPin size={48} />
            <p>Harita Görünümü</p>
            <small>Yakındaki antrenmanlar haritada gösterilecek</small>
          </div>
        </div>
        
        <div className="trainings-list">
          {publicTrainings.map(training => {
            const team = backend.teams.find(t => t.id === training.teamId);
            return (
              <div 
                key={training.id} 
                className="training-list-item"
                onClick={() => {
                  setSelectedTraining(training);
                  setCurrentView('training-detail');
                }}
              >
                <div className="training-list-header">
                  <span className="team-avatar">{team.avatar}</span>
                  <div className="training-list-content">
                    <h3>{training.title}</h3>
                    <p className="team-name">{team.name} • {team.sport}</p>
                    <div className="training-list-info">
                      <span>📅 {training.date.toLocaleDateString('tr-TR')}</span>
                      <span>⏰ {training.time}</span>
                      <span>📍 {training.location.name}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Team Detail View
  const TeamDetailView = () => {
    if (!selectedTeam) return null;
    
    const teamTrainings = backend.trainings.filter(t => t.teamId === selectedTeam.id);
    const isOwner = selectedTeam.ownerId === currentUser.id;
    const isMember = selectedTeam.members.includes(currentUser.id);
    
    return (
      <div className="detail-view">
        <div className="detail-header">
          <button className="btn-back" onClick={() => setCurrentView('home')}>
            ← Geri
          </button>
          <div className="team-detail-hero">
            <div className="team-avatar-xl">{selectedTeam.avatar}</div>
            <h1>{selectedTeam.name}</h1>
            <p className="team-sport-badge">{selectedTeam.sport}</p>
            <p className="team-description">{selectedTeam.description}</p>
            <div className="team-meta">
              <span>📍 {selectedTeam.location}</span>
              <span>👥 {selectedTeam.members.length} üye</span>
              <span>{selectedTeam.isPrivate ? '🔒 Özel Grup' : '🌐 Açık Grup'}</span>
            </div>
            {!isMember && (
              <button className="btn-primary" onClick={() => {
                backend.setTeams(backend.teams.map(t => 
                  t.id === selectedTeam.id 
                    ? {...t, members: [...t.members, currentUser.id]}
                    : t
                ));
                setSelectedTeam({...selectedTeam, members: [...selectedTeam.members, currentUser.id]});
              }}>
                Takıma Katıl
              </button>
            )}
          </div>
        </div>
        
        <div className="detail-content">
          <section className="section">
            <div className="section-header">
              <h2>Antrenmanlar</h2>
              {isOwner && (
                <button className="btn-primary-small" onClick={() => setShowCreateTraining(true)}>
                  <Plus size={16} /> Yeni Antrenman
                </button>
              )}
            </div>
            <div className="trainings-list">
              {teamTrainings.map(training => (
                <div 
                  key={training.id}
                  className="training-list-item"
                  onClick={() => {
                    setSelectedTraining(training);
                    setCurrentView('training-detail');
                  }}
                >
                  <div className="training-list-header">
                    <div className="training-list-content">
                      <h3>{training.title}</h3>
                      <div className="training-list-info">
                        <span>📅 {training.date.toLocaleDateString('tr-TR')}</span>
                        <span>⏰ {training.time}</span>
                        <span>📍 {training.location.name}</span>
                        <span>👥 {training.attendees.length}/{training.capacity}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <section className="section">
            <h2>Üyeler</h2>
            <div className="members-grid">
              {selectedTeam.members.map(memberId => {
                const member = backend.users.find(u => u.id === memberId);
                return (
                  <div key={memberId} className="member-card">
                    <span className="member-avatar">{member.avatar}</span>
                    <span className="member-name">{member.name}</span>
                    {memberId === selectedTeam.ownerId && <span className="owner-badge">👑</span>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  };
  
  // Training Detail View
  const TrainingDetailView = () => {
    if (!selectedTraining) return null;
    
    const team = backend.teams.find(t => t.id === selectedTraining.teamId);
    const isAttending = selectedTraining.attendees.includes(currentUser.id);
    
    return (
      <div className="detail-view">
        <div className="detail-header">
          <button className="btn-back" onClick={() => setCurrentView('explore')}>
            ← Geri
          </button>
          <div className="training-detail-hero">
            <span className="team-avatar-xl">{team.avatar}</span>
            <h1>{selectedTraining.title}</h1>
            <p className="team-name">{team.name}</p>
            
            <div className="training-detail-info">
              <div className="info-card">
                <Calendar size={24} />
                <div>
                  <strong>{selectedTraining.date.toLocaleDateString('tr-TR')}</strong>
                  <small>{selectedTraining.date.toLocaleDateString('tr-TR', { weekday: 'long' })}</small>
                </div>
              </div>
              <div className="info-card">
                <Clock size={24} />
                <div>
                  <strong>{selectedTraining.time}</strong>
                  <small>{selectedTraining.duration} dakika</small>
                </div>
              </div>
              <div className="info-card">
                <MapPin size={24} />
                <div>
                  <strong>{selectedTraining.location.name}</strong>
                  <small>Haritada göster</small>
                </div>
              </div>
              <div className="info-card">
                <Users size={24} />
                <div>
                  <strong>{selectedTraining.attendees.length}/{selectedTraining.capacity}</strong>
                  <small>Katılımcı</small>
                </div>
              </div>
            </div>
            
            <p className="training-description">{selectedTraining.description}</p>
            
            {!isAttending ? (
              <button className="btn-primary" onClick={() => {
                backend.setTrainings(backend.trainings.map(t => 
                  t.id === selectedTraining.id 
                    ? {...t, attendees: [...t.attendees, currentUser.id]}
                    : t
                ));
                setSelectedTraining({...selectedTraining, attendees: [...selectedTraining.attendees, currentUser.id]});
                backend.setNotifications([
                  {id: Date.now(), text: `${selectedTraining.title} antrenmanına katıldınız!`, time: new Date(), read: false},
                  ...backend.notifications
                ]);
              }}>
                Antrenmana Katıl
              </button>
            ) : (
              <button className="btn-secondary" onClick={() => {
                backend.setTrainings(backend.trainings.map(t => 
                  t.id === selectedTraining.id 
                    ? {...t, attendees: t.attendees.filter(id => id !== currentUser.id)}
                    : t
                ));
                setSelectedTraining({...selectedTraining, attendees: selectedTraining.attendees.filter(id => id !== currentUser.id)});
              }}>
                <Check size={16} /> Katılıyorsun
              </button>
            )}
          </div>
        </div>
        
        <div className="detail-content">
          <section className="section">
            <h2>Konum</h2>
            <div className="map-container small">
              <div className="map-placeholder">
                <MapPin size={32} />
                <p>{selectedTraining.location.name}</p>
                <small>Lat: {selectedTraining.location.lat}, Lng: {selectedTraining.location.lng}</small>
                <button className="btn-text">Yol Tarifi Al →</button>
              </div>
            </div>
          </section>
          
          <section className="section">
            <h2>Katılımcılar ({selectedTraining.attendees.length})</h2>
            <div className="members-grid">
              {selectedTraining.attendees.map(userId => {
                const user = backend.users.find(u => u.id === userId);
                return (
                  <div key={userId} className="member-card">
                    <span className="member-avatar">{user.avatar}</span>
                    <span className="member-name">{user.name}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  };
  
  // Create Team Modal
  const CreateTeamModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      sport: '',
      description: '',
      location: '',
      isPrivate: false,
      avatar: '⚽'
    });
    
    const sportEmojis = {
      'Koşu': '🏃',
      'Bisiklet': '🚴',
      'Yüzme': '🏊',
      'Fitness': '💪',
      'Tenis': '🎾',
      'Basketbol': '🏀',
      'Futbol': '⚽',
      'Voleybol': '🏐',
      'Yoga': '🧘',
      'Dağcılık': '🧗'
    };
    
    const handleCreate = () => {
      const newTeam = {
        id: backend.teams.length + 1,
        ...formData,
        ownerId: currentUser.id,
        members: [currentUser.id],
        subscriptionEnd: null,
        avatar: sportEmojis[formData.sport] || '⚽'
      };
      
      setShowPayment({
        type: 'team',
        data: newTeam,
        amount: 49
      });
    };
    
    return (
      <div className="modal-overlay" onClick={() => setShowCreateTeam(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Yeni Takım Oluştur</h2>
            <button className="btn-icon" onClick={() => setShowCreateTeam(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-content">
            <div className="form-group">
              <label>Takım Adı</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: İzmir Sabah Koşucuları"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Spor Dalı</label>
              <select
                className="input"
                value={formData.sport}
                onChange={(e) => setFormData({...formData, sport: e.target.value})}
              >
                <option value="">Seçiniz...</option>
                {Object.keys(sportEmojis).map(sport => (
                  <option key={sport} value={sport}>{sportEmojis[sport]} {sport}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Açıklama</label>
              <textarea
                className="input"
                placeholder="Takımınız hakkında kısa bilgi..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label>Konum</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: Karşıyaka, İzmir"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData({...formData, isPrivate: e.target.checked})}
                />
                <span>Özel Grup (Sadece üyeler görebilir)</span>
              </label>
            </div>
            
            <button className="btn-primary" onClick={handleCreate}>
              Ödemeye Geç (₺49/ay)
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Create Training Modal
  const CreateTrainingModal = () => {
    const myTeams = backend.teams.filter(t => t.ownerId === currentUser.id);
    const [formData, setFormData] = useState({
      teamId: myTeams[0]?.id || '',
      title: '',
      date: '',
      time: '',
      duration: 60,
      location: { name: '', lat: 38.4192, lng: 27.1287 },
      capacity: 20,
      isPublic: true,
      description: ''
    });
    
    const handleCreate = () => {
      const newTraining = {
        id: backend.trainings.length + 1,
        ...formData,
        date: new Date(formData.date),
        attendees: [currentUser.id]
      };
      
      backend.setTrainings([...backend.trainings, newTraining]);
      backend.setNotifications([
        {id: Date.now(), text: `Yeni antrenman oluşturuldu: ${formData.title}`, time: new Date(), read: false},
        ...backend.notifications
      ]);
      setShowCreateTraining(false);
    };
    
    if (myTeams.length === 0) {
      return (
        <div className="modal-overlay" onClick={() => setShowCreateTraining(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Antrenman Oluştur</h2>
              <button className="btn-icon" onClick={() => setShowCreateTraining(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="empty-state">
                <AlertCircle size={48} />
                <p>Antrenman oluşturmak için önce bir takım oluşturmalısınız.</p>
                <button className="btn-primary" onClick={() => {
                  setShowCreateTraining(false);
                  setShowCreateTeam(true);
                }}>
                  Takım Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="modal-overlay" onClick={() => setShowCreateTraining(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Yeni Antrenman Oluştur</h2>
            <button className="btn-icon" onClick={() => setShowCreateTraining(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-content">
            <div className="form-group">
              <label>Takım</label>
              <select
                className="input"
                value={formData.teamId}
                onChange={(e) => setFormData({...formData, teamId: parseInt(e.target.value)})}
              >
                {myTeams.map(team => (
                  <option key={team.id} value={team.id}>{team.avatar} {team.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Antrenman Başlığı</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: Sabah Tempolu Koşu"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Tarih</label>
                <input
                  type="date"
                  className="input"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Saat</label>
                <input
                  type="time"
                  className="input"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Süre (dakika)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>Kapasite</label>
                <input
                  type="number"
                  className="input"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Konum</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: Kordon Boyu, İzmir"
                value={formData.location.name}
                onChange={(e) => setFormData({...formData, location: {...formData.location, name: e.target.value}})}
              />
            </div>
            
            <div className="form-group">
              <label>Açıklama</label>
              <textarea
                className="input"
                placeholder="Antrenman detayları..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                />
                <span>Herkese Açık (Takım dışından katılım)</span>
              </label>
            </div>
            
            <button className="btn-primary" onClick={handleCreate}>
              Antrenman Oluştur
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Payment Modal
  const PaymentModal = () => {
    if (!showPayment) return null;
    
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [processing, setProcessing] = useState(false);
    
    const handlePayment = () => {
      setProcessing(true);
      setTimeout(() => {
        if (showPayment.type === 'team') {
          const teamWithSub = {
            ...showPayment.data,
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          };
          backend.setTeams([...backend.teams, teamWithSub]);
          backend.setNotifications([
            {id: Date.now(), text: `${teamWithSub.name} takımı oluşturuldu!`, time: new Date(), read: false},
            ...backend.notifications
          ]);
        }
        setShowPayment(null);
        setShowCreateTeam(false);
        setProcessing(false);
      }, 2000);
    };
    
    return (
      <div className="modal-overlay" onClick={() => setShowPayment(null)}>
        <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Ödeme</h2>
            <button className="btn-icon" onClick={() => setShowPayment(null)}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-content">
            <div className="payment-summary">
              <CreditCard size={32} />
              <h3>{showPayment.type === 'team' ? 'Takım Aboneliği' : 'Üyelik'}</h3>
              <div className="payment-amount">₺{showPayment.amount}</div>
              <p className="payment-period">/ Aylık</p>
            </div>
            
            <div className="form-group">
              <label>Kart Numarası</label>
              <input
                type="text"
                className="input"
                placeholder="0000 0000 0000 0000"
                maxLength="19"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>Kart Üzerindeki İsim</label>
              <input
                type="text"
                className="input"
                placeholder="AD SOYAD"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Son Kullanma</label>
                <input
                  type="text"
                  className="input"
                  placeholder="AA/YY"
                  maxLength="5"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input
                  type="text"
                  className="input"
                  placeholder="000"
                  maxLength="3"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                />
              </div>
            </div>
            
            <div className="payment-info">
              <AlertCircle size={16} />
              <small>Güvenli ödeme - iyzico ile korunmaktadır</small>
            </div>
            
            <button 
              className="btn-primary" 
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? 'İşlem Yapılıyor...' : `₺${showPayment.amount} Öde`}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Notifications Panel
  const NotificationsPanel = () => {
    return (
      <div className="notifications-panel">
        <div className="notifications-header">
          <h3>Bildirimler</h3>
          <button className="btn-icon" onClick={() => setShowNotifications(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="notifications-list">
          {backend.notifications.map(notif => (
            <div key={notif.id} className={`notification-item ${notif.read ? 'read' : ''}`}>
              <div className="notification-icon">🔔</div>
              <div className="notification-content">
                <p>{notif.text}</p>
                <small>{notif.time.toLocaleTimeString('tr-TR')}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Bottom Navigation
  const BottomNav = () => {
    return (
      <nav className="bottom-nav">
        <button 
          className={currentView === 'home' ? 'nav-item active' : 'nav-item'}
          onClick={() => setCurrentView('home')}
        >
          <div className="nav-icon">🏠</div>
          <span>Ana Sayfa</span>
        </button>
        <button 
          className={currentView === 'explore' ? 'nav-item active' : 'nav-item'}
          onClick={() => setCurrentView('explore')}
        >
          <div className="nav-icon">🔍</div>
          <span>Keşfet</span>
        </button>
        <button 
          className="nav-item"
          onClick={() => setShowCreateTraining(true)}
        >
          <div className="nav-icon-plus">+</div>
          <span>Ekle</span>
        </button>
        <button 
          className={showNotifications ? 'nav-item active' : 'nav-item'}
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <div className="nav-icon">
            🔔
            {backend.notifications.filter(n => !n.read).length > 0 && (
              <span className="notification-badge">
                {backend.notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          <span>Bildirim</span>
        </button>
        <button 
          className={showMenu ? 'nav-item active' : 'nav-item'}
          onClick={() => setShowMenu(!showMenu)}
        >
          <div className="nav-icon">👤</div>
          <span>Profil</span>
        </button>
      </nav>
    );
  };
  
  // Profile Menu
  const ProfileMenu = () => {
    return (
      <div className="profile-menu">
        <div className="profile-header">
          <div className="profile-avatar">{currentUser.avatar}</div>
          <h3>{currentUser.name}</h3>
          <p>{currentUser.email}</p>
        </div>
        <div className="menu-items">
          <button className="menu-item">
            <Settings size={20} />
            <span>Ayarlar</span>
          </button>
          <button className="menu-item" onClick={() => {
            setCurrentUser(null);
            setCurrentView('login');
            setShowMenu(false);
          }}>
            <LogOut size={20} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="app">
      {!currentUser ? (
        <LoginView />
      ) : (
        <>
          {currentView === 'home' && <HomeView />}
          {currentView === 'explore' && <ExploreView />}
          {currentView === 'team-detail' && <TeamDetailView />}
          {currentView === 'training-detail' && <TrainingDetailView />}
          
          <BottomNav />
          
          {showNotifications && <NotificationsPanel />}
          {showMenu && <ProfileMenu />}
          {showCreateTeam && <CreateTeamModal />}
          {showCreateTraining && <CreateTrainingModal />}
          {showPayment && <PaymentModal />}
        </>
      )}
      
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        .app {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: #1a1a1a;
        }
        
        /* Login Styles */
        .login-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .login-hero {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .app-logo {
          font-size: 48px;
          font-weight: 900;
          color: white;
          text-shadow: 0 4px 20px rgba(0,0,0,0.2);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        
        .logo-icon {
          font-size: 56px;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .hero-tagline {
          color: rgba(255,255,255,0.95);
          font-size: 18px;
          font-weight: 500;
        }
        
        .login-box {
          background: white;
          border-radius: 24px;
          padding: 32px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .login-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          background: #f5f5f5;
          border-radius: 12px;
          padding: 4px;
        }
        
        .tab {
          flex: 1;
          padding: 12px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #666;
        }
        
        .tab.active {
          background: white;
          color: #667eea;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .input {
          padding: 14px 16px;
          border: 2px solid #e5e5e5;
          border-radius: 12px;
          font-size: 15px;
          transition: all 0.2s;
          width: 100%;
        }
        
        .input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102,126,234,0.4);
        }
        
        .btn-primary:active {
          transform: translateY(0);
        }
        
        .demo-info {
          text-align: center;
          color: #999;
          font-size: 13px;
          margin-top: 8px;
        }
        
        /* Main Views */
        .home-view, .explore-view, .detail-view {
          padding: 20px 20px 100px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .hero-section {
          margin-bottom: 32px;
        }
        
        .hero-section h1 {
          font-size: 32px;
          font-weight: 800;
          color: white;
          margin-bottom: 8px;
        }
        
        .hero-section p {
          font-size: 16px;
          color: rgba(255,255,255,0.9);
        }
        
        /* Quick Stats */
        .quick-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        
        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .stat-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        
        .stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #667eea;
          margin-bottom: 4px;
        }
        
        .stat-label {
          font-size: 13px;
          color: #666;
          font-weight: 600;
        }
        
        /* Section */
        .section {
          margin-bottom: 32px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .section-header h2 {
          font-size: 22px;
          font-weight: 800;
          color: white;
        }
        
        .btn-text {
          background: none;
          border: none;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        
        .btn-text:hover {
          background: rgba(255,255,255,0.1);
        }
        
        .btn-primary-small {
          background: white;
          color: #667eea;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .btn-primary-small:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        /* Cards */
        .trainings-grid, .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }
        
        .training-card, .team-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .training-card:hover, .team-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        
        .training-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .team-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .training-header h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .team-name {
          font-size: 14px;
          color: #666;
        }
        
        .training-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #555;
        }
        
        .info-item svg {
          color: #667eea;
        }
        
        /* Team Card */
        .team-card {
          text-align: center;
        }
        
        .team-avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          margin: 0 auto 16px;
        }
        
        .team-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .team-sport {
          font-size: 14px;
          color: #667eea;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .team-location {
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
        }
        
        .team-stats {
          display: flex;
          justify-content: center;
          gap: 16px;
          font-size: 13px;
          color: #888;
        }
        
        /* FAB */
        .fab {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          box-shadow: 0 8px 24px rgba(102,126,234,0.4);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .fab:hover {
          transform: scale(1.1);
        }
        
        /* Explore View */
        .explore-header {
          margin-bottom: 24px;
        }
        
        .explore-header h1 {
          font-size: 32px;
          font-weight: 800;
          color: white;
          margin-bottom: 16px;
        }
        
        .search-bar {
          background: white;
          border-radius: 16px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .search-bar input {
          border: none;
          outline: none;
          flex: 1;
          font-size: 15px;
        }
        
        .search-bar svg {
          color: #667eea;
        }
        
        /* Map */
        .map-container {
          background: white;
          border-radius: 16px;
          height: 300px;
          margin-bottom: 24px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .map-container.small {
          height: 200px;
        }
        
        .map-placeholder {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #999;
        }
        
        .map-placeholder svg {
          color: #667eea;
          margin-bottom: 12px;
        }
        
        /* Training List */
        .trainings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .training-list-item {
          background: white;
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        
        .training-list-item:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }
        
        .training-list-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .training-list-content {
          flex: 1;
        }
        
        .training-list-content h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .training-list-info {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 13px;
          color: #666;
          margin-top: 8px;
        }
        
        /* Detail Views */
        .detail-header {
          background: white;
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .btn-back {
          background: #f5f5f5;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 20px;
          transition: all 0.2s;
        }
        
        .btn-back:hover {
          background: #e5e5e5;
        }
        
        .team-detail-hero, .training-detail-hero {
          text-align: center;
        }
        
        .team-avatar-xl {
          width: 100px;
          height: 100px;
          border-radius: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          margin: 0 auto 16px;
        }
        
        .team-detail-hero h1, .training-detail-hero h1 {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        
        .team-sport-badge {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        
        .team-description, .training-description {
          color: #666;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        
        .team-meta {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        
        .training-detail-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin: 24px 0;
        }
        
        .info-card {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .info-card svg {
          color: #667eea;
        }
        
        .info-card strong {
          display: block;
          font-size: 16px;
          margin-bottom: 2px;
        }
        
        .info-card small {
          color: #666;
          font-size: 13px;
        }
        
        .btn-secondary {
          background: #e8f5e9;
          color: #2e7d32;
          border: none;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn-secondary:hover {
          background: #c8e6c9;
        }
        
        .detail-content {
          background: white;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .detail-content .section {
          margin-bottom: 32px;
        }
        
        .detail-content h2 {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 16px;
        }
        
        /* Members Grid */
        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        
        .member-card {
          background: #f9f9f9;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          position: relative;
        }
        
        .member-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 8px;
        }
        
        .member-name {
          font-size: 13px;
          font-weight: 600;
          display: block;
        }
        
        .owner-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 16px;
        }
        
        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          backdrop-filter: blur(4px);
        }
        
        .modal {
          background: white;
          border-radius: 24px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .modal-header {
          padding: 24px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h2 {
          font-size: 22px;
          font-weight: 800;
        }
        
        .btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #f5f5f5;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .btn-icon:hover {
          background: #e5e5e5;
        }
        
        .modal-content {
          padding: 24px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }
        
        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .checkbox-label input {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }
        
        .empty-state {
          text-align: center;
          padding: 40px 20px;
        }
        
        .empty-state svg {
          color: #667eea;
          margin-bottom: 16px;
        }
        
        .empty-state p {
          color: #666;
          margin-bottom: 20px;
        }
        
        /* Payment Modal */
        .payment-summary {
          text-align: center;
          padding: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
          margin-bottom: 24px;
        }
        
        .payment-summary svg {
          margin-bottom: 12px;
        }
        
        .payment-amount {
          font-size: 48px;
          font-weight: 900;
          margin-bottom: 4px;
        }
        
        .payment-period {
          opacity: 0.9;
        }
        
        .payment-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f0f9ff;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .payment-info svg {
          color: #0284c7;
          flex-shrink: 0;
        }
        
        .payment-info small {
          color: #0369a1;
          font-size: 13px;
        }
        
        /* Notifications */
        .notifications-panel {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 100%;
          max-width: 400px;
          background: white;
          box-shadow: -4px 0 20px rgba(0,0,0,0.1);
          z-index: 999;
          display: flex;
          flex-direction: column;
        }
        
        .notifications-header {
          padding: 20px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .notifications-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }
        
        .notification-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 8px;
          background: #f9f9f9;
          transition: all 0.2s;
        }
        
        .notification-item.read {
          opacity: 0.6;
        }
        
        .notification-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .notification-content p {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .notification-content small {
          color: #999;
          font-size: 12px;
        }
        
        /* Profile Menu */
        .profile-menu {
          position: fixed;
          right: 20px;
          bottom: 90px;
          width: 280px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          z-index: 999;
        }
        
        .profile-header {
          padding: 24px;
          text-align: center;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 12px;
        }
        
        .profile-header h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .profile-header p {
          font-size: 13px;
          color: #666;
        }
        
        .menu-items {
          padding: 8px;
        }
        
        .menu-item {
          width: 100%;
          padding: 14px 16px;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .menu-item:hover {
          background: #f5f5f5;
        }
        
        .menu-item svg {
          color: #667eea;
        }
        
        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-around;
          padding: 8px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
          z-index: 100;
        }
        
        .nav-item {
          flex: 1;
          border: none;
          background: none;
          padding: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          border-radius: 12px;
          transition: all 0.2s;
          position: relative;
        }
        
        .nav-item span {
          font-size: 11px;
          font-weight: 600;
          color: #999;
        }
        
        .nav-item.active span {
          color: #667eea;
        }
        
        .nav-icon {
          font-size: 24px;
          opacity: 0.6;
          position: relative;
        }
        
        .nav-item.active .nav-icon {
          opacity: 1;
        }
        
        .nav-icon-plus {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 300;
          margin-top: -24px;
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }
        
        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .quick-stats {
            grid-template-columns: repeat(3, 1fr);
          }
          
          .trainings-grid, .teams-grid {
            grid-template-columns: 1fr;
          }
          
          .training-detail-info {
            grid-template-columns: 1fr;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .notifications-panel {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default SporlaApp;