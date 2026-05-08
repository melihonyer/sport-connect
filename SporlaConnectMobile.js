// SporlaConnect - React Native Mobil Uygulama
// iOS ve Android için tam özellikli spor topluluğu platformu

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  Modal,
  FlatList,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';

// Not: Gerçek uygulamada bu paketler yüklenmelidir:
// npm install react-native-maps
// npm install @react-navigation/native @react-navigation/stack
// npm install react-native-vector-icons
// npm install @react-native-async-storage/async-storage
// npm install react-native-push-notification

// Simüle edilmiş backend servisi
const BackendAPI = {
  users: [
    { id: 1, name: 'Ahmet Yılmaz', email: 'ahmet@email.com', password: 'demo123', avatar: '🏃' },
    { id: 2, name: 'Ayşe Kaya', email: 'ayse@email.com', password: 'demo123', avatar: '🚴' },
  ],
  teams: [
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
      location: 'İzmir Kordon',
      rating: 4.8
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
      location: 'Karşıyaka',
      rating: 4.9
    }
  ],
  trainings: [
    {
      id: 1,
      teamId: 1,
      title: 'Sabah Tempolu Koşu',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      time: '06:30',
      duration: 60,
      location: { 
        name: 'Kordon Boyu', 
        latitude: 38.4192, 
        longitude: 27.1287,
        address: 'Kordon, Alsancak, İzmir'
      },
      capacity: 20,
      attendees: [1, 2],
      isPublic: true,
      description: '10 km tempo koşusu. Islak hava için hazırlıklı gelin.',
      difficulty: 'Orta'
    },
    {
      id: 2,
      teamId: 1,
      title: 'Hafta Sonu Uzun Koşu',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      time: '07:00',
      duration: 90,
      location: { 
        name: 'İnciraltı Kent Ormanı', 
        latitude: 38.4567, 
        longitude: 27.0456,
        address: 'İnciraltı, Balçova, İzmir'
      },
      capacity: 15,
      attendees: [1],
      isPublic: true,
      description: '15 km orman parkuru. Teknik parkur.',
      difficulty: 'Zor'
    }
  ],
  
  login: (email, password) => {
    return BackendAPI.users.find(u => u.email === email && u.password === password);
  },
  
  register: (name, email, password) => {
    const newUser = {
      id: BackendAPI.users.length + 1,
      name,
      email,
      password,
      avatar: '👤'
    };
    BackendAPI.users.push(newUser);
    return newUser;
  },
  
  createTeam: (teamData, userId) => {
    const newTeam = {
      id: BackendAPI.teams.length + 1,
      ...teamData,
      ownerId: userId,
      members: [userId],
      subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rating: 5.0
    };
    BackendAPI.teams.push(newTeam);
    return newTeam;
  },
  
  createTraining: (trainingData) => {
    const newTraining = {
      id: BackendAPI.trainings.length + 1,
      ...trainingData,
      attendees: []
    };
    BackendAPI.trainings.push(newTraining);
    return newTraining;
  },
  
  joinTeam: (teamId, userId) => {
    const team = BackendAPI.teams.find(t => t.id === teamId);
    if (team && !team.members.includes(userId)) {
      team.members.push(userId);
    }
    return team;
  },
  
  joinTraining: (trainingId, userId) => {
    const training = BackendAPI.trainings.find(t => t.id === trainingId);
    if (training && !training.attendees.includes(userId)) {
      training.attendees.push(userId);
    }
    return training;
  }
};

// Ana Uygulama Komponenti
const SporlaConnectApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Hoş geldiniz! Yeni antrenmanları keşfedin.', read: false }
  ]);

  // Login Ekranı
  const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');

    const handleLogin = () => {
      const user = BackendAPI.login(email, password);
      if (user) {
        setCurrentUser(user);
        setCurrentScreen('home');
        addNotification(`Hoş geldin ${user.name}! 👋`);
      } else {
        Alert.alert('Hata', 'E-posta veya şifre hatalı!');
      }
    };

    const handleRegister = () => {
      if (!name || !email || !password) {
        Alert.alert('Hata', 'Lütfen tüm alanları doldurun!');
        return;
      }
      const user = BackendAPI.register(name, email, password);
      setCurrentUser(user);
      setCurrentScreen('home');
      addNotification('Hesabınız başarıyla oluşturuldu! 🎉');
    };

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <Text style={styles.logoIcon}>⚡</Text>
            <Text style={styles.logoText}>SporlaConnect</Text>
            <Text style={styles.tagline}>
              Spor arkadaşlarını bul, antrenmanlara katıl, hedeflerine ulaş
            </Text>
          </View>

          <View style={styles.loginBox}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, !isRegister && styles.tabActive]}
                onPress={() => setIsRegister(false)}
              >
                <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                  Giriş Yap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, isRegister && styles.tabActive]}
                onPress={() => setIsRegister(true)}
              >
                <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                  Kayıt Ol
                </Text>
              </TouchableOpacity>
            </View>

            {isRegister && (
              <TextInput
                style={styles.input}
                placeholder="Ad Soyad"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Şifre"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={isRegister ? handleRegister : handleLogin}
            >
              <Text style={styles.primaryButtonText}>
                {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.demoInfo}>
              Demo: ahmet@email.com / demo123
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // Ana Sayfa
  const HomeScreen = () => {
    const myTeams = BackendAPI.teams.filter(t => t.members.includes(currentUser.id));
    const publicTrainings = BackendAPI.trainings.filter(t => t.isPublic);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.homeContainer}>
          {/* Header */}
          <View style={styles.homeHeader}>
            <View>
              <Text style={styles.greeting}>Merhaba {currentUser.name}! 👋</Text>
              <Text style={styles.subGreeting}>Bugün hangi antrenmana katılmak istersin?</Text>
            </View>
            <TouchableOpacity onPress={() => setCurrentScreen('notifications')}>
              <View style={styles.notificationIcon}>
                <Text style={styles.bellIcon}>🔔</Text>
                {notifications.filter(n => !n.read).length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {notifications.filter(n => !n.read).length}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* İstatistikler */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{myTeams.length}</Text>
              <Text style={styles.statLabel}>Takımım</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🏃</Text>
              <Text style={styles.statValue}>{publicTrainings.length}</Text>
              <Text style={styles.statLabel}>Açık Antrenman</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>
                {BackendAPI.trainings.filter(t => t.attendees.includes(currentUser.id)).length}
              </Text>
              <Text style={styles.statLabel}>Katıldığım</Text>
            </View>
          </View>

          {/* Yakındaki Antrenmanlar */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Yakındaki Açık Antrenmanlar</Text>
              <TouchableOpacity onPress={() => setCurrentScreen('explore')}>
                <Text style={styles.seeAllText}>Tümünü Gör →</Text>
              </TouchableOpacity>
            </View>
            {publicTrainings.slice(0, 3).map(training => (
              <TrainingCard
                key={training.id}
                training={training}
                onPress={() => {
                  setSelectedTraining(training);
                  setCurrentScreen('trainingDetail');
                }}
              />
            ))}
          </View>

          {/* Takımlarım */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Takımlarım</Text>
              <TouchableOpacity onPress={() => setCurrentScreen('createTeam')}>
                <View style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Yeni Takım</Text>
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myTeams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onPress={() => {
                    setSelectedTeam(team);
                    setCurrentScreen('teamDetail');
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setCurrentScreen('createTraining')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <BottomNavigation currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
      </SafeAreaView>
    );
  };

  // Keşfet Ekranı
  const ExploreScreen = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const filteredTrainings = BackendAPI.trainings.filter(t =>
      t.isPublic &&
      (searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        BackendAPI.teams.find(team => team.id === t.teamId)?.sport.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.exploreContainer}>
          <Text style={styles.exploreTitle}>Antrenman Keşfet</Text>

          {/* Arama Çubuğu */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Spor dalı veya antrenman ara..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Harita Placeholder */}
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapIcon}>📍</Text>
            <Text style={styles.mapText}>Harita Görünümü</Text>
            <Text style={styles.mapSubtext}>Yakındaki antrenmanlar haritada gösterilecek</Text>
          </View>

          {/* Antrenman Listesi */}
          <FlatList
            data={filteredTrainings}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TrainingListItem
                training={item}
                onPress={() => {
                  setSelectedTraining(item);
                  setCurrentScreen('trainingDetail');
                }}
              />
            )}
            contentContainerStyle={styles.trainingsList}
          />
        </View>
        <BottomNavigation currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
      </SafeAreaView>
    );
  };

  // Takım Detay Ekranı
  const TeamDetailScreen = () => {
    if (!selectedTeam) return null;

    const teamTrainings = BackendAPI.trainings.filter(t => t.teamId === selectedTeam.id);
    const isOwner = selectedTeam.ownerId === currentUser.id;
    const isMember = selectedTeam.members.includes(currentUser.id);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={styles.backButton}>← Geri</Text>
            </TouchableOpacity>

            <View style={styles.teamDetailHero}>
              <Text style={styles.teamAvatarXL}>{selectedTeam.avatar}</Text>
              <Text style={styles.teamDetailTitle}>{selectedTeam.name}</Text>
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>{selectedTeam.sport}</Text>
              </View>
              <Text style={styles.teamDescription}>{selectedTeam.description}</Text>

              <View style={styles.teamMetaContainer}>
                <Text style={styles.teamMeta}>📍 {selectedTeam.location}</Text>
                <Text style={styles.teamMeta}>👥 {selectedTeam.members.length} üye</Text>
                <Text style={styles.teamMeta}>
                  {selectedTeam.isPrivate ? '🔒 Özel' : '🌐 Açık'}
                </Text>
                <Text style={styles.teamMeta}>⭐ {selectedTeam.rating}</Text>
              </View>

              {!isMember && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    BackendAPI.joinTeam(selectedTeam.id, currentUser.id);
                    addNotification(`${selectedTeam.name} takımına katıldınız!`);
                    setCurrentScreen('home');
                  }}
                >
                  <Text style={styles.primaryButtonText}>Takıma Katıl</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Antrenmanlar */}
          <View style={styles.detailSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Antrenmanlar</Text>
              {isOwner && (
                <TouchableOpacity onPress={() => setCurrentScreen('createTraining')}>
                  <Text style={styles.addButtonText}>+ Ekle</Text>
                </TouchableOpacity>
              )}
            </View>
            {teamTrainings.map(training => (
              <TrainingListItem
                key={training.id}
                training={training}
                onPress={() => {
                  setSelectedTraining(training);
                  setCurrentScreen('trainingDetail');
                }}
              />
            ))}
          </View>

          {/* Üyeler */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Üyeler ({selectedTeam.members.length})</Text>
            <View style={styles.membersGrid}>
              {selectedTeam.members.map(memberId => {
                const member = BackendAPI.users.find(u => u.id === memberId);
                return (
                  <View key={memberId} style={styles.memberCard}>
                    <Text style={styles.memberAvatar}>{member.avatar}</Text>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {memberId === selectedTeam.ownerId && (
                      <Text style={styles.ownerBadge}>👑</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Antrenman Detay Ekranı
  const TrainingDetailScreen = () => {
    if (!selectedTraining) return null;

    const team = BackendAPI.teams.find(t => t.id === selectedTraining.teamId);
    const isAttending = selectedTraining.attendees.includes(currentUser.id);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setCurrentScreen('explore')}>
              <Text style={styles.backButton}>← Geri</Text>
            </TouchableOpacity>

            <View style={styles.trainingDetailHero}>
              <Text style={styles.teamAvatarXL}>{team.avatar}</Text>
              <Text style={styles.teamDetailTitle}>{selectedTraining.title}</Text>
              <Text style={styles.teamName}>{team.name}</Text>

              <View style={styles.trainingInfoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>📅</Text>
                  <Text style={styles.infoLabel}>
                    {selectedTraining.date.toLocaleDateString('tr-TR')}
                  </Text>
                  <Text style={styles.infoSubtext}>
                    {selectedTraining.date.toLocaleDateString('tr-TR', { weekday: 'long' })}
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>⏰</Text>
                  <Text style={styles.infoLabel}>{selectedTraining.time}</Text>
                  <Text style={styles.infoSubtext}>{selectedTraining.duration} dk</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <Text style={styles.infoLabel}>{selectedTraining.location.name}</Text>
                  <Text style={styles.infoSubtext}>Haritada gör</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>👥</Text>
                  <Text style={styles.infoLabel}>
                    {selectedTraining.attendees.length}/{selectedTraining.capacity}
                  </Text>
                  <Text style={styles.infoSubtext}>Katılımcı</Text>
                </View>
              </View>

              <Text style={styles.trainingDescription}>{selectedTraining.description}</Text>

              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>Zorluk: {selectedTraining.difficulty}</Text>
              </View>

              {!isAttending ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    BackendAPI.joinTraining(selectedTraining.id, currentUser.id);
                    addNotification(`${selectedTraining.title} antrenmanına katıldınız!`);
                    setCurrentScreen('home');
                  }}
                >
                  <Text style={styles.primaryButtonText}>Antrenmana Katıl</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.attendingBadge}>
                  <Text style={styles.attendingText}>✓ Katılıyorsun</Text>
                </View>
              )}
            </View>
          </View>

          {/* Konum */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Konum</Text>
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapIcon}>📍</Text>
              <Text style={styles.mapText}>{selectedTraining.location.name}</Text>
              <Text style={styles.mapSubtext}>{selectedTraining.location.address}</Text>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Yol Tarifi Al →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Katılımcılar */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>
              Katılımcılar ({selectedTraining.attendees.length})
            </Text>
            <View style={styles.membersGrid}>
              {selectedTraining.attendees.map(userId => {
                const user = BackendAPI.users.find(u => u.id === userId);
                return (
                  <View key={userId} style={styles.memberCard}>
                    <Text style={styles.memberAvatar}>{user.avatar}</Text>
                    <Text style={styles.memberName}>{user.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Takım Oluştur Ekranı
  const CreateTeamScreen = () => {
    const [formData, setFormData] = useState({
      name: '',
      sport: '',
      description: '',
      location: '',
      isPrivate: false,
      avatar: '⚽'
    });

    const sports = [
      { name: 'Koşu', emoji: '🏃' },
      { name: 'Bisiklet', emoji: '🚴' },
      { name: 'Yüzme', emoji: '🏊' },
      { name: 'Fitness', emoji: '💪' },
      { name: 'Tenis', emoji: '🎾' },
      { name: 'Basketbol', emoji: '🏀' },
      { name: 'Futbol', emoji: '⚽' },
      { name: 'Voleybol', emoji: '🏐' },
      { name: 'Yoga', emoji: '🧘' },
      { name: 'Dağcılık', emoji: '🧗' },
    ];

    const handleCreate = () => {
      if (!formData.name || !formData.sport) {
        Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun!');
        return;
      }

      const selectedSport = sports.find(s => s.name === formData.sport);
      const teamData = {
        ...formData,
        avatar: selectedSport?.emoji || '⚽'
      };

      BackendAPI.createTeam(teamData, currentUser.id);
      addNotification(`${formData.name} takımı oluşturuldu! 🎉`);
      setCurrentScreen('home');
    };

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={styles.backButton}>← Geri</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Yeni Takım Oluştur</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Takım Adı *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: İzmir Sabah Koşucuları"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Spor Dalı *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportPicker}>
              {sports.map(sport => (
                <TouchableOpacity
                  key={sport.name}
                  style={[
                    styles.sportOption,
                    formData.sport === sport.name && styles.sportOptionSelected
                  ]}
                  onPress={() => setFormData({ ...formData, sport: sport.name })}
                >
                  <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                  <Text style={styles.sportName}>{sport.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Açıklama</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Takımınız hakkında kısa bilgi..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Konum</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Karşıyaka, İzmir"
              placeholderTextColor="#999"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
            />
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
          >
            <View style={[styles.checkbox, formData.isPrivate && styles.checkboxChecked]}>
              {formData.isPrivate && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Özel Grup (Sadece üyeler görebilir)</Text>
          </TouchableOpacity>

          <View style={styles.pricingInfo}>
            <Text style={styles.pricingIcon}>💳</Text>
            <Text style={styles.pricingText}>Takım Aboneliği: ₺49/ay</Text>
            <Text style={styles.pricingSubtext}>İlk 30 gün ücretsiz deneme</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleCreate}>
            <Text style={styles.primaryButtonText}>Takım Oluştur</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Antrenman Oluştur Ekranı
  const CreateTrainingScreen = () => {
    const myTeams = BackendAPI.teams.filter(t => t.ownerId === currentUser.id);
    const [formData, setFormData] = useState({
      teamId: myTeams[0]?.id || null,
      title: '',
      date: new Date(),
      time: '06:30',
      duration: 60,
      location: { name: '', latitude: 38.4192, longitude: 27.1287, address: '' },
      capacity: 20,
      isPublic: true,
      description: '',
      difficulty: 'Orta'
    });

    if (myTeams.length === 0) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyText}>
              Antrenman oluşturmak için önce bir takım oluşturmalısınız.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentScreen('createTeam')}
            >
              <Text style={styles.primaryButtonText}>Takım Oluştur</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    const handleCreate = () => {
      if (!formData.title || !formData.location.name) {
        Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun!');
        return;
      }

      BackendAPI.createTraining(formData);
      addNotification(`${formData.title} antrenmanı oluşturuldu!`);
      setCurrentScreen('home');
    };

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={styles.backButton}>← Geri</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Yeni Antrenman Oluştur</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Takım *</Text>
            <View style={styles.teamSelector}>
              {myTeams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamOption,
                    formData.teamId === team.id && styles.teamOptionSelected
                  ]}
                  onPress={() => setFormData({ ...formData, teamId: team.id })}
                >
                  <Text style={styles.teamOptionEmoji}>{team.avatar}</Text>
                  <Text style={styles.teamOptionName}>{team.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Antrenman Başlığı *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Sabah Tempolu Koşu"
              placeholderTextColor="#999"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Saat</Text>
              <TextInput
                style={styles.input}
                placeholder="06:30"
                placeholderTextColor="#999"
                value={formData.time}
                onChangeText={(text) => setFormData({ ...formData, time: text })}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Süre (dk)</Text>
              <TextInput
                style={styles.input}
                placeholder="60"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={formData.duration.toString()}
                onChangeText={(text) => setFormData({ ...formData, duration: parseInt(text) || 60 })}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Konum *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Kordon Boyu, İzmir"
              placeholderTextColor="#999"
              value={formData.location.name}
              onChangeText={(text) =>
                setFormData({ ...formData, location: { ...formData.location, name: text } })
              }
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Açıklama</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Antrenman detayları..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Zorluk Seviyesi</Text>
            <View style={styles.difficultySelector}>
              {['Kolay', 'Orta', 'Zor'].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.difficultyOption,
                    formData.difficulty === level && styles.difficultyOptionSelected
                  ]}
                  onPress={() => setFormData({ ...formData, difficulty: level })}
                >
                  <Text
                    style={[
                      styles.difficultyText,
                      formData.difficulty === level && styles.difficultyTextSelected
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setFormData({ ...formData, isPublic: !formData.isPublic })}
          >
            <View style={[styles.checkbox, formData.isPublic && styles.checkboxChecked]}>
              {formData.isPublic && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Herkese Açık (Takım dışından katılım)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleCreate}>
            <Text style={styles.primaryButtonText}>Antrenman Oluştur</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Bildirimler Ekranı
  const NotificationsScreen = () => {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.notificationsContainer}>
          <View style={styles.notificationsHeader}>
            <Text style={styles.notificationsTitle}>Bildirimler</Text>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[styles.notificationItem, item.read && styles.notificationRead]}>
                <Text style={styles.notificationIcon}>🔔</Text>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationText}>{item.text}</Text>
                  <Text style={styles.notificationTime}>Az önce</Text>
                </View>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    );
  };

  // Yardımcı Fonksiyonlar
  const addNotification = (text) => {
    setNotifications([
      { id: Date.now(), text, read: false },
      ...notifications
    ]);
  };

  // Alt Bileşenler
  const TrainingCard = ({ training, onPress }) => {
    const team = BackendAPI.teams.find(t => t.id === training.teamId);
    return (
      <TouchableOpacity style={styles.trainingCard} onPress={onPress}>
        <View style={styles.trainingCardHeader}>
          <Text style={styles.teamAvatarSmall}>{team.avatar}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.trainingCardTitle}>{training.title}</Text>
            <Text style={styles.trainingCardTeam}>{team.name}</Text>
          </View>
        </View>
        <View style={styles.trainingCardInfo}>
          <Text style={styles.trainingCardInfoText}>
            📅 {training.date.toLocaleDateString('tr-TR')}
          </Text>
          <Text style={styles.trainingCardInfoText}>⏰ {training.time}</Text>
          <Text style={styles.trainingCardInfoText}>📍 {training.location.name}</Text>
          <Text style={styles.trainingCardInfoText}>
            👥 {training.attendees.length}/{training.capacity}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const TeamCard = ({ team, onPress }) => (
    <TouchableOpacity style={styles.teamCardHorizontal} onPress={onPress}>
      <Text style={styles.teamCardAvatar}>{team.avatar}</Text>
      <Text style={styles.teamCardTitle}>{team.name}</Text>
      <Text style={styles.teamCardSport}>{team.sport}</Text>
      <Text style={styles.teamCardLocation}>📍 {team.location}</Text>
      <View style={styles.teamCardStats}>
        <Text style={styles.teamCardStat}>{team.members.length} üye</Text>
        <Text style={styles.teamCardStat}>{team.isPrivate ? '🔒' : '🌐'}</Text>
      </View>
    </TouchableOpacity>
  );

  const TrainingListItem = ({ training, onPress }) => {
    const team = BackendAPI.teams.find(t => t.id === training.teamId);
    return (
      <TouchableOpacity style={styles.trainingListItem} onPress={onPress}>
        <Text style={styles.teamAvatarSmall}>{team.avatar}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.trainingListTitle}>{training.title}</Text>
          <Text style={styles.trainingListSubtitle}>
            {team.name} • {team.sport}
          </Text>
          <View style={styles.trainingListInfo}>
            <Text style={styles.trainingListInfoText}>
              📅 {training.date.toLocaleDateString('tr-TR')}
            </Text>
            <Text style={styles.trainingListInfoText}>⏰ {training.time}</Text>
            <Text style={styles.trainingListInfoText}>📍 {training.location.name}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const BottomNavigation = ({ currentScreen, setCurrentScreen }) => (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setCurrentScreen('home')}
      >
        <Text style={[styles.navIcon, currentScreen === 'home' && styles.navIconActive]}>
          🏠
        </Text>
        <Text style={[styles.navLabel, currentScreen === 'home' && styles.navLabelActive]}>
          Ana Sayfa
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setCurrentScreen('explore')}
      >
        <Text style={[styles.navIcon, currentScreen === 'explore' && styles.navIconActive]}>
          🔍
        </Text>
        <Text style={[styles.navLabel, currentScreen === 'explore' && styles.navLabelActive]}>
          Keşfet
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItemCenter}
        onPress={() => setCurrentScreen('createTraining')}
      >
        <View style={styles.navIconPlus}>
          <Text style={styles.navIconPlusText}>+</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setCurrentScreen('notifications')}
      >
        <View>
          <Text style={[styles.navIcon, currentScreen === 'notifications' && styles.navIconActive]}>
            🔔
          </Text>
          {notifications.filter(n => !n.read).length > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>
                {notifications.filter(n => !n.read).length}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.navLabel, currentScreen === 'notifications' && styles.navLabelActive]}>
          Bildirim
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => Alert.alert('Profil', 'Profil sayfası geliştiriliyor...')}
      >
        <Text style={styles.navIcon}>👤</Text>
        <Text style={styles.navLabel}>Profil</Text>
      </TouchableOpacity>
    </View>
  );

  // Ana render
  if (!currentUser) {
    return <LoginScreen />;
  }

  switch (currentScreen) {
    case 'home':
      return <HomeScreen />;
    case 'explore':
      return <ExploreScreen />;
    case 'teamDetail':
      return <TeamDetailScreen />;
    case 'trainingDetail':
      return <TrainingDetailScreen />;
    case 'createTeam':
      return <CreateTeamScreen />;
    case 'createTraining':
      return <CreateTrainingScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    default:
      return <HomeScreen />;
  }
};

// Stiller
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  
  // Login Styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '500',
  },
  loginBox: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#667eea',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  demoInfo: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
  },
  
  // Home Styles
  homeContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  notificationIcon: {
    position: 'relative',
  },
  bellIcon: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
  },
  seeAllText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '700',
  },
  
  // Training Card
  trainingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  trainingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  teamAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#667eea',
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 44,
  },
  trainingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  trainingCardTeam: {
    fontSize: 13,
    color: '#666',
  },
  trainingCardInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trainingCardInfoText: {
    fontSize: 13,
    color: '#555',
  },
  
  // Team Card
  teamCardHorizontal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 160,
    alignItems: 'center',
  },
  teamCardAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#667eea',
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 12,
  },
  teamCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  teamCardSport: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 4,
  },
  teamCardLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  teamCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  teamCardStat: {
    fontSize: 12,
    color: '#888',
  },
  
  // FAB
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '300',
  },
  
  // Explore Styles
  exploreContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  exploreTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    padding: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
  },
  mapPlaceholder: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    height: 200,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mapIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  trainingsList: {
    padding: 20,
  },
  trainingListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  trainingListTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  trainingListSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  trainingListInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trainingListInfoText: {
    fontSize: 12,
    color: '#888',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
  },
  
  // Detail Styles
  detailHeader: {
    backgroundColor: 'white',
    borderRadius: 24,
    margin: 20,
    padding: 20,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 16,
  },
  teamDetailHero: {
    alignItems: 'center',
  },
  teamAvatarXL: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#667eea',
    fontSize: 48,
    textAlign: 'center',
    lineHeight: 100,
    marginBottom: 12,
  },
  teamDetailTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  sportBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  sportBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  teamDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  teamMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  teamMeta: {
    fontSize: 14,
    color: '#666',
  },
  teamName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  trainingDetailHero: {
    alignItems: 'center',
  },
  trainingInfoGrid: {
    width: '100%',
    gap: 12,
    marginVertical: 20,
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  trainingDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  difficultyBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  difficultyText: {
    color: '#856404',
    fontSize: 13,
    fontWeight: '600',
  },
  attendingBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  attendingText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: '700',
  },
  detailSection: {
    backgroundColor: 'white',
    borderRadius: 24,
    margin: 20,
    marginTop: 0,
    padding: 20,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  memberCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 90,
    position: 'relative',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: 6,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  ownerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Form Styles
  formContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  formHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  formGroup: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  sportPicker: {
    marginTop: 8,
  },
  sportOption: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  sportOptionSelected: {
    backgroundColor: '#667eea',
  },
  sportEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  sportName: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  pricingInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  pricingIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  pricingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 4,
  },
  pricingSubtext: {
    fontSize: 13,
    color: '#0284c7',
  },
  teamSelector: {
    gap: 8,
  },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  teamOptionSelected: {
    backgroundColor: '#e8f0fe',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  teamOptionEmoji: {
    fontSize: 32,
  },
  teamOptionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  difficultySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyOption: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  difficultyOptionSelected: {
    backgroundColor: '#667eea',
  },
  difficultyTextSelected: {
    color: 'white',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  
  // Notifications
  notificationsContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationsTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f9f9f9',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  notificationRead: {
    opacity: 0.6,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemCenter: {
    flex: 1,
    alignItems: 'center',
    marginTop: -24,
  },
  navIcon: {
    fontSize: 24,
    opacity: 0.6,
    marginBottom: 4,
  },
  navIconActive: {
    opacity: 1,
  },
  navIconPlus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navIconPlusText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '300',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
  },
  navLabelActive: {
    color: '#667eea',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default SporlaConnectApp;
