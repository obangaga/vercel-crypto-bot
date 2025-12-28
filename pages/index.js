import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualCheckLoading, setManualCheckLoading] = useState(false);
  
  useEffect(() => {
    fetchStatus();
  }, []);
  
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleManualCheck = async () => {
    setManualCheckLoading(true);
    try {
      const response = await fetch('/api/check');
      const data = await response.json();
      alert(`Manual check completed! Found ${data.tokens_found} tokens.`);
      fetchStatus(); // Refresh status
    } catch (error) {
      alert('Error performing manual check');
    } finally {
      setManualCheckLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🤖 Crypto Monitor Bot</h1>
        <p style={styles.subtitle}>Real-time monitoring for cookin.fun tokens</p>
      </header>
      
      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Bot Status</h2>
          <div style={styles.statusIndicator}>
            <span style={{
              ...styles.statusDot,
              backgroundColor: status?.status === 'operational' ? '#10B981' : '#EF4444'
            }}></span>
            <span style={styles.statusText}>
              {status?.status === 'operational' ? 'Operational' : 'Error'}
            </span>
          </div>
          
          <div style={styles.statsGrid}>
            <div style={styles.stat}>
              <div style={styles.statNumber}>{status?.statistics?.total_checks || 0}</div>
              <div style={styles.statLabel}>Total Checks</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>{status?.statistics?.total_tokens_sent || 0}</div>
              <div style={styles.statLabel}>Tokens Sent</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>
                {status?.environment?.bot_configured ? '✅' : '❌'}
              </div>
              <div style={styles.statLabel}>Bot Configured</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>
                {status?.environment?.redis_configured ? '✅' : '❌'}
              </div>
              <div style={styles.statLabel}>Redis Storage</div>
            </div>
          </div>
        </div>
        
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Actions</h2>
          <div style={styles.buttonGroup}>
            <button 
              style={styles.button}
              onClick={handleManualCheck}
              disabled={manualCheckLoading}
            >
              {manualCheckLoading ? 'Checking...' : '🔍 Manual Check'}
            </button>
            <button 
              style={styles.buttonSecondary}
              onClick={fetchStatus}
            >
              🔄 Refresh Status
            </button>
            <a 
              href="/api/status" 
              style={styles.buttonSecondary}
              target="_blank"
              rel="noopener noreferrer"
            >
              📊 JSON API
            </a>
          </div>
        </div>
        
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Recent Activity</h2>
          {status?.recent_executions?.length > 0 ? (
            <div style={styles.activityList}>
              {status.recent_executions.map((exec, index) => (
                <div key={index} style={styles.activityItem}>
                  <div style={styles.activityTime}>
                    {new Date(exec.timestamp).toLocaleString()}
                  </div>
                  <div style={styles.activityDetail}>
                    Sent {exec.tokens_sent} tokens
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noActivity}>No recent activity</p>
          )}
        </div>
        
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Quick Links</h2>
          <div style={styles.links}>
            <a href="https://cookin.fun" target="_blank" rel="noopener noreferrer" style={styles.link}>
              🌐 cookin.fun
            </a>
            <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" style={styles.link}>
              🤖 BotFather
            </a>
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={styles.link}>
              ▲ Vercel Dashboard
            </a>
            <a href="https://github.com/yourusername/vercel-crypto-bot" target="_blank" rel="noopener noreferrer" style={styles.link}>
              💻 GitHub Repo
            </a>
          </div>
        </div>
      </main>
      
      <footer style={styles.footer}>
        <p>Powered by Vercel Serverless Functions • Auto-check every 5 minutes</p>
        <p style={styles.footerSmall}>
          Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'N/A'}
        </p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: '#111827',
    color: 'white',
    padding: '2rem 1rem',
    textAlign: 'center'
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
    fontWeight: 'bold'
  },
  subtitle: {
    fontSize: '1.125rem',
    opacity: 0.9
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem',
    display: 'grid',
    gap: '1.5rem'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#111827'
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem'
  },
  statusDot: {
    width: '0.75rem',
    height: '0.75rem',
    borderRadius: '50%',
    display: 'inline-block'
  },
  statusText: {
    fontSize: '1rem',
    fontWeight: '500'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem'
  },
  stat: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '0.375rem'
  },
  statNumber: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    color: '#111827'
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem'
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  button: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  buttonSecondary: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    textAlign: 'center'
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  activityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.375rem'
  },
  activityTime: {
    fontSize: '0.875rem',
    color: '#6b7280'
  },
  activityDetail: {
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  noActivity: {
    color: '#6b7280',
    fontStyle: 'italic'
  },
  links: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.75rem'
  },
  link: {
    display: 'block',
    padding: '0.75rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    textDecoration: 'none',
    borderRadius: '0.375rem',
    textAlign: 'center',
    transition: 'background-color 0.2s'
  },
  footer: {
    textAlign: 'center',
    padding: '2rem 1rem',
    color: '#6b7280',
    fontSize: '0.875rem',
    borderTop: '1px solid #e5e7eb',
    marginTop: '2rem'
  },
  footerSmall: {
    fontSize: '0.75rem',
    marginTop: '0.5rem',
    opacity: 0.75
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.125rem',
    color: '#6b7280'
  }
};
