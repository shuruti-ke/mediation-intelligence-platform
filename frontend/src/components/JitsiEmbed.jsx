import { useEffect, useRef, useState } from 'react';

/**
 * Jitsi Meet embed - mediation room video.
 * For JaaS: loads script from 8x8.vc/{app_id}/external_api.js, uses domain 8x8.vc.
 */
export default function JitsiEmbed({ roomName, domain = 'meet.jit.si', jwt, jaasAppId, displayName = 'Mediator', onReady }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(!jaasAppId);

  useEffect(() => {
    if (jaasAppId) {
      if (document.querySelector(`script[src*="8x8.vc/${jaasAppId}"]`)) {
        setScriptLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://8x8.vc/${jaasAppId}/external_api.js`;
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.head.appendChild(script);
      return () => script.remove();
    } else {
      setScriptLoaded(true);
    }
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
