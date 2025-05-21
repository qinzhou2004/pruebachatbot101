import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import config from '../templates/bot-config';
const STORAGE_KEY = 'chat_history'; 

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const chatContainerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const activityTimeoutRef = useRef(null);
  const lastMessageRef = useRef(null);

  // 初始化消息从本地存储加载
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (error) {
          console.error('Error parsing chat history:', error);
        }
      }
    }
  }, []);

  // 保存消息到本地存储
  const saveToStorage = (messages) => {
    try {
      const data = JSON.stringify(messages);
      if (data.length > 6000000) {
        const trimmed = messages.slice(-25);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return;
      }
      localStorage.setItem(STORAGE_KEY, data);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      const trimmed = messages.slice(-10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  };

  useEffect(() => {
    saveToStorage(messages);
  }, [messages]);

// 优化后的定时器管理
const resetIdleTimer = () => {
  // 清除所有定时器
  clearTimeout(idleTimerRef.current);
  clearTimeout(countdownTimerRef.current);
  
  // 如果已经显示关闭弹窗则不再处理
  if (showCloseModal) return;

  // 当前处于空闲提示状态
  if (showIdleModal) {
    countdownTimerRef.current = setTimeout(() => {
      closeChat();
    }, 30000);
  } 
  // 正常状态
  else {
    idleTimerRef.current = setTimeout(() => {
      setShowIdleModal(true);
      setCountdown(30); // 重置倒计时显示
      countdownTimerRef.current = setTimeout(closeChat, 30000);
    }, 60000);
  }
};

const closeChat = () => {
  setShowIdleModal(false);
  setShowCloseModal(true);
  setMessages([]);
  clearTimeout(countdownTimerRef.current);
};

 // 用户活动处理
const handleActivity = () => {
  if (showCloseModal) return;
  
  // 如果当前显示空闲提示
  if (showIdleModal) {
    setCountdown(30); // 重置倒计时显示
    clearTimeout(countdownTimerRef.current);
    countdownTimerRef.current = setTimeout(closeChat, 30000);
  }
  resetIdleTimer();
};

  // 设置事件监听器
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    resetIdleTimer(); // 初始化计时器

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimeout(idleTimerRef.current);
      clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // 倒计时效果
  useEffect(() => {
    let interval;
    if (showIdleModal) {
      interval = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showIdleModal]);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [messages]);
  // 初始化线程
  useEffect(() => {
    const initializeThread = async () => {
      try {
        const response = await fetch('/api/init-thread');
        const data = await response.json();
        setThreadId(data.threadId);
        
        if (messages.length === 0) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: config.welcomeMessage 
          }]);
        }
      } catch (error) {
        console.error('Error initializing thread:', error);
        setMessages([{
          role: 'assistant',
          content: config.errorMessage || 'Disculpa, estoy teniendo problemas. ¿Podrías intentarlo de nuevo?'
        }]);
      }
    };
    
    initializeThread();
  }, []);

  // 处理聊天提交
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          threadId: threadId 
        }),
      });

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: config.errorMessage || 'Disculpa, estoy teniendo dificultades. ¿Podrías intentarlo de nuevo?'
      }]);
    } finally {
      setIsLoading(false);
      handleActivity(); // 重置空闲计时器
    }
  };

    // 修改后的模态框按钮处理
    const handleContinue = () => {
      setShowIdleModal(false);
      resetIdleTimer(); // 完全重置所有定时器
    };

    const handleNewChat = () => {
    setShowCloseModal(false);
    setMessages([{
      role: 'assistant',
      content: config.welcomeMessage
    }]);
    fetch('/api/init-thread')
      .then(res => res.json())
      .then(data => setThreadId(data.threadId))
      .catch(console.error);
    resetIdleTimer();
  };
  // 新增关闭聊天处理（用于第一个模态框的关闭按钮）
  const handleCloseChat = () => {
    closeChat();
    handleNewChat(); // 复用新建聊天逻辑
  };

  return (
    <div 
      className={styles.container}
      style={{
        '--color-primary': config.cssConfig.primaryColor,
        '--color-secondary': config.cssConfig.secondaryColor,
        '--message-radius': config.cssConfig.messageRadius,
        '--input-radius': config.cssConfig.inputRadius,
        '--chat-width': config.cssConfig.chatWidth,
        '--chat-height': config.cssConfig.chatHeight,
        '--font-family': config.cssConfig.fontFamily,
        '--font-size': config.cssConfig.fontSize,
        maxWidth: config.cssConfig.chatWidth,
        fontFamily: config.cssConfig.fontFamily,
        fontSize: config.cssConfig.fontSize
      }}
    >
      <Head>
        <title>{config.pageTitle || 'Chatbot'}</title>
        <meta name="description" content={config.subHeading || ''} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header 
        className={styles.header}
        style={{
          background: `linear-gradient(to right, ${config.cssConfig.secondaryColor}, ${config.cssConfig.primaryColor})`
        }}
      >
        <h1>{config.mainHeading || 'Chatbot'}</h1>
        {config.subHeading && <p>{config.subHeading}</p>}
      </header>

      <div className={styles.chatLayout}>
        <div 
          ref={chatContainerRef}
          className={styles.chatContainer}
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              ref={index === messages.length - 1 ? lastMessageRef : null}
              className={`${styles.message} ${
                msg.role === 'user' 
                  ? styles.userMessage 
                  : styles.assistantMessage
              } ${index === 0 ? styles.firstMessage : ''}`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && config.cssConfig.showTypingIndicator && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
            </div>
          )}
          {showIdleModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <p>¿Sigues ahí? Tu conversación se pausará en {countdown} segundos</p>
                <div className={styles.modalButtons}>
                  <button onClick={handleContinue}>
                    Continuar
                  </button>
                  <button onClick={() => window.open(config.feedbackUrl, '_blank')}>
                    Dejar tus reseñas
                  </button>
                  <button 
                    onClick={handleCloseChat}  // 改为调用关闭方法
                    style={{ 
                      backgroundColor: 'white',
                      color: '#666',
                      border: '1px solid #ddd'
                    }}
                  >
                    Cerrar esta chat
                  </button>
                </div>
              </div>
            </div>
          )}
                {showCloseModal && (
                  <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                      <p>La conversación se ha cerrado por inactividad.</p>
                      <div className={styles.modalButtons}>
                        <button
                          onClick={handleNewChat}
                          style={{ backgroundColor: config.cssConfig.primaryColor }}
                        >
                          Nuevo chat
                        </button>
                        <button onClick={() => setShowCloseModal(false)}>
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
        </div>

        <div className={styles.inputArea}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={config.inputPlaceholder || 'Escribe tu mensaje aquí...'}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {config.submitButtonText || 'Enviar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}