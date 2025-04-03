# src/servidor/video/sdp_generator.py
import socket

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_sdp_file(port=5000):
    ip = get_local_ip()
    sdp_content = f"""v=0
    o=- 0 0 IN IP4 {ip}
    s=H264 Low-Latency Stream
    c=IN IP4 {ip}
    t=0 0
    a=tool:GStreamer
    a=type:broadcast
    m=video {port} RTP/AVP 96
    a=rtpmap:96 H264/90000
    a=fmtp:96 profile-level-id=42001f;packetization-mode=1
    a=control:track0
    """
    with open("src/servidor/video/stream.sdp", "w") as f:
        f.write(sdp_content)
    print(f"[SDP] Archivo stream.sdp generado con IP {ip}")