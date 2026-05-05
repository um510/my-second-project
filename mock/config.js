// Resolve API base URL from admin setting. Default is server.
(function () {
	if (window.API_BASE_URL) return;
	const STORAGE_KEY = 'db_connection_mode';
	const mode = localStorage.getItem(STORAGE_KEY);
	window.API_BASE_URL = mode === 'local'
		? 'http://localhost:3000'
		: 'https://product-master-api.onrender.com';
})();
