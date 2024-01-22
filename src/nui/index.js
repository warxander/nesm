$(function () {
	let audioContext;

	window.addEventListener('message', function (event) {
		const data = event.data;

		if (data.initRequest) {
			audioContext = new AudioContext();
			$.post(`https://${GetParentResourceName()}/init`, JSON.stringify({
				sampleRate: audioContext.sampleRate
			}));
		}
	});
});
