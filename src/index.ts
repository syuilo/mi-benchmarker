// AiOS bootstrapper

import process from 'node:process';
import fs from 'node:fs';
import chalk from 'chalk';
import got from 'got';
import promiseRetry from 'promise-retry';
import http from 'node:http';
import https from 'node:https';

import Bot from './bot.js';
import config from './config.js';
import log from './utils/log.js';

const NUMBER_OF_BOTS = 500;
const NUNBER_OF_FOLLOWS_PER_BOT = 100;

log('welcome to mi-fake-bots');

process.on('uncaughtException', err => {
	try {
		console.error(`Uncaught exception: ${err.message}`);
		console.dir(err, { colors: true, depth: 2 });
	} catch { }
});

promiseRetry(retry => {
	log(`Admin account fetching... ${chalk.gray(config.host)}`);

	// アカウントをフェッチ
	return got.post(`${config.apiUrl}/i`, {
		json: {
			i: config.i
		}
	}).json().catch(retry);
}, {
	retries: 3
}).then(account => {
	const acct = `@${account.username}`;
	log(chalk.green(`Account fetched successfully: ${chalk.underline(acct)}`));

	if (config.accounts && config.accounts.length > 0) {
		initBots(config.accounts);
	} else {
		const makeAccountPromises = Array.from(Array(NUMBER_OF_BOTS)).map(() => makeAccount());

		Promise.all(makeAccountPromises).then(accounts => {
			log(chalk.green('Accounts created successfully'));
			log(accounts.map(account => `${account.token}`).join(' '));

			fs.writeFileSync('_accounts_.json', JSON.stringify(accounts.map(account => ({
				id: account.id,
				username: account.username,
				token: account.token
			})), null, 0), 'utf8');

			initBots(accounts);
		}).catch(e => {
			log(chalk.red(e));
		});
	}
}).catch(e => {
	log(chalk.red('Failed to fetch the admin account'));
});

function makeAccount() {
	log('Creating an account...');
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return got.post(`${config.apiUrl}/admin/accounts/create`, {
		json: {
			i: config.i,
			username: 'fake_' + Array.from(Array(12)).map(()=>chars[Math.floor(Math.random()*chars.length)]).join(''),
			password: 'password',
		},
		agent: {
			http: new http.Agent({ keepAlive: true }),
			https: new https.Agent({ keepAlive: true })
		}
	}).json();
}

async function initBots(accounts) {
	async function initBot(account) {
		log(`Initializing bot: ${account.username}`);

		const bot = new Bot(account);

		const nonFollowingAccounts = accounts.filter(x => x.id !== account.id);
		const following = [];

		for (let i = 0; i < NUNBER_OF_FOLLOWS_PER_BOT; i++) {
			const target = nonFollowingAccounts[Math.floor(Math.random() * nonFollowingAccounts.length)];
			following.push(target);
			nonFollowingAccounts.splice(nonFollowingAccounts.indexOf(target), 1);
		}

		await Promise.all(following.map((f) => {
			return bot.api('following/create', {
				userId: f.id
			});
		}));

		log(`Bot initialized: ${account.username}`);

		return bot;
	}

	const bots = await Promise.all(accounts.map(x => initBot(x)));

	for (const bot of bots) {
		bot.run();
	}
}
