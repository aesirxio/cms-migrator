import dotenv from 'dotenv'

declare var process: {
	env: {
		WORDPRESS_API_URL: string
		JOOMLA_BEARER_TOKEN: string
		JOOMLA_API_URL: string
		AESIRX_API_URL: string
		AESIRX_BEARER_TOKEN: string
		AESIRX_MIGRATE: string
		MIGRATION_KEY: string
		LOGGER_LEVEL: number
	}
}

dotenv.config()

import {RestClient} from 'typed-rest-client/RestClient';
import {BearerCredentialHandler} from "typed-rest-client/handlers/bearertoken";
import {Joomla} from "./joomla/script";
import {AesirX} from "./aesirx/script";
import {Wordpress} from "./wordpress/script";
import { Logger } from "tslog"

export async function run() {
	try {
		const logger: Logger<null> = new Logger({ minLevel: process.env['LOGGER_LEVEL'] ?? 6 });
		const aesirx = new AesirX(
			new RestClient(
				'aesirx_migrator',
				undefined,
				[
					new BearerCredentialHandler(
						process.env['AESIRX_BEARER_TOKEN'],
						false
					)
				]
			),
			process.env['AESIRX_API_URL'],
			process.env['MIGRATION_KEY'] ?? process.env['AESIRX_MIGRATE']
		)
			.addLogger(logger)

		switch (process.env['AESIRX_MIGRATE']) {
			case 'WORDPRESS':
				new Wordpress(
					aesirx,
					new RestClient(
						'aesirx_migrator',
						process.env['WORDPRESS_API_URL']
					)
				)
					.addLogger(logger)
					.runAll()
				break;
			case 'JOOMLA':
			default:
				new Joomla(
					aesirx,
					new RestClient(
						'aesirx_migrator',
						process.env['JOOMLA_API_URL'],
						[
							new BearerCredentialHandler(
								process.env['JOOMLA_BEARER_TOKEN'],
								false
							)
						]
					)
				)
					.addLogger(logger)
					.runAll()
				break;
		}

	} catch (err) {
		// @ts-ignore
		console.error('Failed: ' + err.message);
	}
}

run()