# Event Examples

Contains examples of some of the event emmited from the Event endpoint in Wolf.

## API Other Events

:keepalive

## PAIRING

**NOTES**

- host_ip is the wolf server
- client_ip is the remote client trying to connect/pair

### PAIR SIGNAL

```
event: wolf::core::events::PairSignal
data: {"client_ip":"10.1.1.13","host_ip":"10.1.1.20"}
```

## STREAM

**NOTES**

- SessionID is equal to ClientID

### START

```
event: wolf::core::events::StreamSession
data: {"app_id":"378473508","client_id":"6201138780842581792","client_ip":"10.1.1.13","aes_key":"9546c0ff8c6b56d9d765afb956088b64","aes_iv":"-221927770","rtsp_fake_ip":"105.84.160.14","video_width":2560,"video_height":1440,"video_refresh_rate":120,"audio_channel_count":2,"client_settings":{"run_uid":1000,"run_gid":1000,"controllers_override":[],"mouse_acceleration":1.0,"v_scroll_acceleration":1.0,"h_scroll_acceleration":1.0}}
```

### PAUSE

```
event: wolf::core::events::PauseStreamEvent
data: {"session_id":6201138780842581792}
```

### STOP

```
event: wolf::core::events::StopStreamEvent
data: {"session_id":6201138780842581792}
```

## SESSION INFO

**NOTES**

- START SESSION also contains information that would be part of SESSION INFO

```
event: wolf::core::events::VideoSession
data: {"display_mode":{"width":2560,"height":1440,"refreshRate":120},"gst_pipeline":"videotestsrc pattern=ball flip=true is-live=true !\nvideo/x-raw, framerate={fps}/1\n !\nvapostproc !\nvideo/x-raw(memory:VAMemory), format=NV12, chroma-site={color_range}, width={width}, height={height},\ncolorimetry={color_space}, pixel-aspect-ratio=1/1 !\nvah265enc aud=false b-frames=0 ref-frames=1 num-slices={slices_per_frame} bitrate={bitrate} cpb-size={bitrate} key-int-max=1024 rate-control=cqp target-usage=6 !\nh265parse !\nvideo/x-h265, profile=main, stream-format=byte-stream !\nrtpmoonlightpay_video name=moonlight_pay payload_size={payload_size} fec_percentage={fec_percentage} min_required_fec_packets={min_required_fec_packets} !\nappsink sync=false name=wolf_udp_sink\n","session_id":6201138780842581792,"port":48100,"timeout_ms":7000,"wait_for_ping":true,"packet_size":1392,"frames_with_invalid_ref_threshold":0,"fec_percentage":20,"min_required_fec_packets":2,"bitrate_kbps":44908,"slices_per_frame":1,"color_range":"MPEG","color_space":"BT601","client_ip":"10.1.1.13","rtp_secret_payload":[93,47,105,41,118,100,103,42,77,83,38,34,52,44,98,118]}
```

```
event: wolf::core::events::AudioSession
data: {"gst_pipeline":"audiotestsrc wave=ticks is-live=true !\nqueue max-size-buffers=3 leaky=downstream ! audiorate ! audioconvert !\nopusenc bitrate={bitrate} bitrate-type=cbr frame-size={packet_duration} bandwidth=fullband audio-type=restricted-lowdelay max-payload-size=1400 !\nrtpmoonlightpay_audio name=moonlight_pay packet_duration={packet_duration} encrypt={encrypt} aes_key=\"{aes_key}\" aes_iv=\"{aes_iv}\" !\nappsink name=wolf_udp_sink","session_id":6201138780842581792,"encrypt_audio":true,"aes_key":"781f0cab7e3f7137d6a08cf63b726080","aes_iv":"-1202587803","port":48200,"wait_for_ping":true,"client_ip":"10.1.1.13","rtp_secret_payload":[93,47,105,41,118,100,103,42,77,83,38,34,52,44,98,118],"packet_duration":5,"audio_mode":{"channels":2,"streams":1,"coupled_streams":1,"speakers":["FRONT_LEFT","FRONT_RIGHT"],"bitrate":96000,"sample_rate":48000}}
```

## Example for testing Wolf Socket

curl -N --unix-socket /var/run/wolf/wolf.sock http://localhost/api/v1/events
