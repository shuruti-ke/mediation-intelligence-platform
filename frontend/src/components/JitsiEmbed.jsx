import { useEffect, useRef, useState } from 'react';

/**
 * Jitsi Meet embed - mediation room video.
 * For JaaS: loads script from 8x8.vc/{app_id}/external_api.js, uses domain 8x8.vc.
 */
export default function JitsiEmbed({ roomName, domain = 'meet.jit.si', jwt, jaasAppId, displayName = 'Mediator', onReady }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    const scriptUrl = jaasAppId
      ? `https://8x8.vc/${jaasAppId}/external_api.js`
      : 'https://meet.jit.si/external_api.js';
    const existing = document.querySelector(`script[src*="${jaasAppId ? '8x8.vc' : 'meet.jit.si'}"]`);
    if (existing) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    // Don't remove script on unmount - avoids duplicate load & "kernel already registered" errors
  }, [jaasAppId]);

  useEffect(() => {
    if (!roomName || !containerRef.current || !scriptLoaded || typeof window.JitsiMeetExternalAPI === 'undefined') return;

    const options = {
      roomName,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      ...(jwt && { jwt }),
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        prejoinPageEnabled: false,
        disableThirdPartyRequests: true,
        resolution: 720,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop',
          'fullscreen', 'hangup', 'chat', 'recording', 'settings'
        ],
        SHOW_JITSI_WATERMARK: false,
      },
      userInfo: { displayName },
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);
    apiRef.current = api;

    api.addEventListener('videoConferenceJoined', () => {
      onReady?.();
    });

    return () => {
      api.dispose();
      apiRef.current = null;
    };
  }, [roomName, domain, jwt, displayName, scriptLoaded]);

  return <div ref={containerRef} style={{ width: '100%', height: '500px', minHeight: '400px' }} />;
}
