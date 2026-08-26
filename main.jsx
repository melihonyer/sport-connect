import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './sporla-bulusma.jsx';
import './index.css';
import { initAnalytics } from './analytics.js';

// Meta pixel'i React'ten önce başlat: reklamdan gelen kullanıcının kaynağı
// (utm/fbclid) uygulama açılırken URL'den yakalanır, sonra temizlenebilir.
initAnalytics();

// eslint-disable-next-line no-undef
window.__BUILD_TIME__ = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 0;

// Global error boundary — beyaz ekran yerine kullanıcı dostu hata gösterir
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) {
    console.error("[RootErrorBoundary]", err.message, info?.componentStack?.split('\n')[1]);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight:'100svh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'#f8fafc', padding:'24px', textAlign:'center', gap:'16px',
        fontFamily:"'Montserrat',system-ui,sans-serif"
      }}>
        <div style={{ fontSize:40 }}>⚠️</div>
        <p style={{ fontWeight:700, fontSize:18, color:'#0f172a', margin:0 }}>Bir şeyler ters gitti</p>
        <p style={{ color:'#94a3b8', fontSize:13, maxWidth:300, margin:0 }}>
          {this.state.error?.message || 'Beklenmedik bir hata oluştu.'}
        </p>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{
            padding:'10px 28px', borderRadius:12, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#00b7ba,#009295)',
            color:'white', fontWeight:700, fontSize:14,
            fontFamily:"'Montserrat',system-ui,sans-serif"
          }}>
          Sayfayı Yenile
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
