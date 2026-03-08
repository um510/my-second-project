// Switch API base URL by hostname.
// - local preview: Flask on localhost:3000
// - deployed site: Render API
(function () {
	if (window.API_BASE_URL) return;
	const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
	window.API_BASE_URL = isLocal
		? 'http://localhost:3000'
		: 'https://product-master-api.onrender.com';
})();
