'use strict';

const constants = require('./constants');
const logger = require('./logger');
const { db, groups, meta, routesHelpers } = require('./nodebb');


// NodeBB list of Hooks: https://github.com/NodeBB/NodeBB/wiki/Hooks
const Plugin = {
	marksMap: new Map(),
	usersMap: new Map(),

	hooks: {
		actions: {},
		filters: {},
		statics: {
			load: async function (params) {
				const { router, middleware } = params;

				function renderAdmin(req, res) {
					res.render(`admin/plugins/${constants.PLUGIN_TOKEN}`, {});
				}
				routesHelpers.setupAdminPageRoute(router, `/admin/plugins/${constants.PLUGIN_TOKEN}`, middleware, [], renderAdmin);

				const settings = await meta.settings.get(constants.PLUGIN_TOKEN);
				await Plugin.restructure(settings);
			},
		},
	},

	async restructure(settings) {
		const groupMarks = settings['group-post-mark'] ?? [];
		if (!groupMarks) {
			return;
		}

		Plugin.marksMap = new Map();
		Plugin.usersMap = new Map();

		const groupNames = [];
		for (const groupMark of groupMarks) {
			groupNames.push(groupMark.groupName);
			Plugin.marksMap.set(groupMark.groupName, groupMark);
		}

		const members = await groups.getMembersOfGroups(groupNames);
		members.forEach((groupMembers, index) => {
			if (!groupMembers.length) {
				return;
			}
			groupMembers.forEach((uid) => {
				const intUid = parseInt(uid, 10);
				if (!Plugin.usersMap.has(intUid)) {
					Plugin.usersMap.set(intUid, new Set());
				}
				Plugin.usersMap.get(intUid).add(groupNames[index]);
			});
		});
	},
};

/**
 * Called on `action:settings.set`
 */
Plugin.hooks.actions.settingsSet = async function (data) {
	if (data.plugin === constants.PLUGIN_TOKEN) {
		await Plugin.restructure(data.settings);
	}
};

/**
 * Called on `filter:admin.header.build`
 */
Plugin.hooks.filters.adminHeaderBuild = async function (header) {
	header.plugins.push({
		route: `/plugins/${constants.PLUGIN_TOKEN}`,
		icon: 'fa-tag',
		name: 'Group Post Mark',
	});
	return header;
};

/**
 * Called on `filter:topic.getFields`
 */
Plugin.hooks.filters.topicGetFields = async function ({ tids, topics, fields, keys }) {
	try {
		const postersInTopics = await db.getSortedSetsMembers(tids.map(tid => `tid:${tid}:posters`));
		postersInTopics.forEach((posters, index) => {
			if (!posters) {
				return;
			}

			const uidsFromGroups = new Set();
			for (const poster of posters) {
				const uid = parseInt(poster, 10);
				if (Plugin.usersMap.has(uid)) {
					uidsFromGroups.add(uid);
				}
			}
			if (!uidsFromGroups.size) {
				return;
			}

			const groupsWithMarks = new Set();
			for (const uid of uidsFromGroups) {
				const groups = Plugin.usersMap.get(uid);
				groups.forEach(group => groupsWithMarks.add(group));
			}
			if (!groupsWithMarks.size) {
				return;
			}

			const groupPostMark = [];
			for (const group of groupsWithMarks) {
				groupPostMark.push(Plugin.marksMap.get(group));
			}
			topics[index].groupPostMark = groupPostMark;
		});
	} catch (err) {
		logger.error(err);
	}

	return { tids, topics, fields, keys };
};

/**
 * Called on `filter:post.getFields`
 */
Plugin.hooks.filters.postGetFields = async function ({ pids, posts, fields }) {
	if (!fields.includes('uid')) {
		return { pids, posts, fields };
	}

	try {
		for (const post of posts) {
			const uid = parseInt(post.uid, 10);
			if (!Plugin.usersMap.has(uid)) {
				continue;
			}

			const groupPostMark = [];
			for (const group of Plugin.usersMap.get(uid)) {
				if (Plugin.marksMap.has(group)) {
					groupPostMark.push(Plugin.marksMap.get(group));
				}
			}

			post.groupPostMark = groupPostMark;
		}
	} catch (err) {
		logger.error(err);
	}

	return { pids, posts, fields };
};

module.exports = Plugin;
