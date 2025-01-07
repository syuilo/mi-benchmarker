import * as fs from 'node:fs';
import { bindThis } from '@/decorators.js';
import loki from 'lokijs';
import { FormData, File } from 'formdata-node';
import chalk from 'chalk';
import { v4 as uuid } from 'uuid';
import http from 'node:http';
import https from 'node:https';
import got from 'got';

import config from '@/config.js';
import type { User } from '@/misskey/user.js';
import Stream from '@/stream.js';
import log from '@/utils/log.js';
import { sleep } from './utils/sleep.js';

export default class Bot {
	public account: User;
	public connection: Stream | null = null;
	public db: loki;

	constructor(account: User) {
		this.account = account;
	}

	@bindThis
	public log(msg: string) {
		log(`[${chalk.magenta('Bot')} @${this.account.username}]: ${msg}`);
	}

	@bindThis
	public run() {
		this.connection = new Stream(this.account.token);

		//#region Main stream
		const mainStream = this.connection.useSharedConnection('main');

		this.connection.connectToChannel('hybridTimeline');

		this.log(chalk.green.bold('now running'));

		const postRandom = () => {
			this.post({
				text: `Hello, world! ${uuid()}`,
			});

			setTimeout(postRandom, Math.random() * 1000 * 60 * 3);
		}

		setTimeout(postRandom, Math.random() * 1000 * 60 * 3);

		const readRandom = () => {
			if (Math.random() < 0.5) {
				this.api('notes/hybrid-timeline', {
					limit: 10,
				});
			} else {
				this.api('notes/timeline', {
					limit: 10,
				});
			}

			setTimeout(readRandom, Math.random() * 1000 * 60);
		}

		readRandom();
	}

	/**
	 * ファイルをドライブにアップロードします
	 */
	@bindThis
	public async upload(file: Buffer | fs.ReadStream, meta: { filename: string, contentType: string }) {
		const form = new FormData();
		form.set('i', this.account.token);
		form.set('file', new File([file], meta.filename, { type: meta.contentType }));

		const res = await got.post({
			url: `${config.apiUrl}/drive/files/create`,
			body: form
		}).json();
		return res;
	}

	/**
	 * 投稿します
	 */
	@bindThis
	public async post(param: any) {
		const res = await this.api('notes/create', param);
		return res.createdNote;
	}

	/**
	 * APIを呼び出します
	 */
	@bindThis
	public api(endpoint: string, param?: any) {
		const before = performance.now();

		const req = got.post(`${config.apiUrl}/${endpoint}`, {
			json: Object.assign({
				i: this.account.token,
			}, param),
		}).json();

		req.then((res) => {
			this.log(`API: ${endpoint} ${chalk.gray('(' + Math.round(performance.now() - before) + 'ms)')}`);
		});

		return req;
	}

		/**
	 * APIを呼び出します
	 */
		@bindThis
		public apiNode(endpoint: string, param?: any) {
			this.log(`API: ${endpoint}`);
			return new Promise((resolve, reject) => {
				const req = http.request(`${config.apiUrl}/${endpoint}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
				}, (res) => {
					res.setEncoding('utf8');
					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => {
						resolve(JSON.parse(data));
					});
				});
	
				req.on('error', (e) => {
					console.error(`problem with request: ${e.message}`);
					reject(e);
				});
	
				req.write(JSON.stringify(Object.assign({
					i: this.account.token,
				}, param)));
	
				req.end();
			});
		}
}
