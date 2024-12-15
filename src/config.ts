type Config = {
	host: string;
	i: string;
	wsUrl: string;
	apiUrl: string;
	memoryDir?: string;
};

import config from '../config.json' with { type: 'json' };

config.wsUrl = config.host.replace('http', 'ws');
config.apiUrl = config.host + '/api';

export default config as Config;
