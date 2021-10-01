'use strict';

define('admin/plugins/group-post-mark', ['settings'], function (settings) {
	var ACP = {};

	ACP.init = function () {
		settings.load('group-post-mark', $('.group-post-mark-settings'));
		$('#save').on('click', saveSettings);
	};

	function saveSettings() {
		settings.save('group-post-mark', $('.group-post-mark-settings'), function () {
			app.alert({
				type: 'success',
				alert_id: 'group-post-mark-saved',
				title: 'Settings Saved',
				message: 'Please reload your NodeBB to apply these settings',
				clickfn: function () {
					socket.emit('admin.restart');
				},
			});
		});
	}

	return ACP;
});
