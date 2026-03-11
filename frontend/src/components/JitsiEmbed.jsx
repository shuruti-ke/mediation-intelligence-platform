import { useEffect, useRef } from 'react';

/**
 * Jitsi Meet embed - mediation room video.
 * Room name format: mediation-{case_id}-{session_id}
 */
export default function JitsiEmbed({ roomName, domain = 'meet.jit.si', jwt, displayName = 'Mediator', onReady }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    if (!roomName || !containerRef.current || typeof window.JitsiMeetExternalAPI === 'undefined') return;

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
  }, [roomName, domain, jwt, displayName]);

  return <div ref={containerRef} style={{ width: '100%', height: '500px', minHeight: '400px' }} />;
}
