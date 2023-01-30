import {IRequestOptions, IRestResponse, RestClient} from "typed-rest-client";
import {IRequestQueryParams} from "typed-rest-client/Interfaces";
import {Category, Post, Tag} from "./models";
import {CategoryResource, ItemResource, TagResource} from "../aesirx/models";
import {AesirX, Entity} from "../aesirx/script";
import {Logger} from "tslog";

export class Wordpress {
	private from: RestClient
	private limit: number = 20
	private aesirx: AesirX;
	private logger: Logger<any>;

	constructor(aesirx: AesirX, from: RestClient, limit: number = 20) {
		this.limit = limit
		this.from = from
		this.aesirx = aesirx
		this.logger = new Logger({ type: "hidden" });
	}

	public addLogger(logger: Logger<any>):this {
		this.logger = logger
		return this
	}

	private async run<T>(url: string, params: object, done: (item: T) => Promise<void>): Promise<void> {
		let page: number = 1

		while (true) {
			const options: IRequestOptions = {
				acceptHeader: "*/*",
				additionalHeaders: {
					"Content-Type": 'application/json; charset=utf-8'
				},
				queryParameters: <IRequestQueryParams><unknown>{
					params: {...{
						per_page: this.limit,
						page: page,
						order: 'asc',
						orderby: 'id'
					},
					...params}
				}
			}

			const restRes: IRestResponse<Array<T>> = await this.from.get(url, options);

			if (restRes.statusCode != 200 || restRes.result === null) {
				throw new Error('Data not found')
			}

			this.logger.info('Selected list of entities from URL ' + url)
			this.logger.debug('params', options.queryParameters)

			if (restRes.result.length == 0) {
				break
			}

			// Probably less heavier for frontend executions
			// https://gist.github.com/joeytwiddle/37d2085425c049629b80956d3c618971#process-each-player-in-serial-using-arrayprototypereduce
			await restRes.result.reduce(async (prev, item) => {
				// Wait for the previous item to finish processing
				await prev
				// Process this item
				await done(item)
			}, Promise.resolve())

			if (restRes.result.length < this.limit) {
				break
			}

			page += 1;
		}
	}

	public async runCategories(): Promise<void> {
		let parents: Array<number> = [0];
		while (true) {
			if (parents.length === 0) {
				break
			}

			// @ts-ignore
			let parent: number = parents.pop()

			await this.run<Category>(
				'/wp-json/wp/v2/categories',
				{
					parent: parent,
				},
				async (item) => {
					const resource: CategoryResource = {
						title: item.name,
						remote_key: item.id,
						description: item.description,
					};

					if (item.parent != 0) {
						resource.parent_id = await this.aesirx.getRemoteEntityId(item.parent, Entity.Category)
					}

					const remoteId = await this.aesirx.create(Entity.Category, resource)

					parents.push(item.id)

					this.logger.info('Saved Category with remote id ' + remoteId)
					this.logger.debug('resource', resource)
				}
			)
		}
	}

	public async runPosts(): Promise<void> {
		await this.run<Post>(
			'/wp-json/wp/v2/posts',
			{},
			async (item) => {

				const resource: ItemResource = {
					title: item.title.rendered,
					metaverse_content: item.content.rendered,
					excerpt: item.excerpt.rendered,
					remote_key: item.id,

					// Empty tags and assign again later
					aesirx_tags: [],
				};

				if (item.categories.length) {
					resource.categories = [];

					for (const id of item.categories) {
						resource.categories.push(await this.aesirx.getRemoteEntityId(
							id, Entity.Category
						))
					}
				}

				const remoteId = await this.aesirx.create(Entity.Item, resource)

				this.logger.info('Saved Post with remote id ' + remoteId)
				this.logger.debug('resource', resource)

				for (const idx of item.tags) {
					await this.aesirx.addTag({
						content_id: remoteId,
						tag_id: await this.aesirx.getRemoteEntityId(idx, Entity.Tag),
					})
				}
			}
		)
	}

	public async runPages(): Promise<void> {
		await this.run<Post>(
			'/wp-json/wp/v2/pages',
			{},
			async (item) => {

				const resource: ItemResource = {
					title: item.title.rendered,
					metaverse_content: item.content.rendered,
					excerpt: item.excerpt.rendered,
					remote_key: item.id,
				};

				const remoteId = await this.aesirx.create(Entity.Item, resource)

				this.logger.info('Saved Page with remote id ' + remoteId)
				this.logger.debug('resource', resource)
			}
		)
	}

	public async runTags(): Promise<void> {
		await this.run<Tag>(
			'/wp-json/wp/v2/tags',
			{},
			async (item) => {

				const resource: TagResource = {
					title: item.name,
					description: item.description,
					remote_key: item.id,
				};

				const remoteId = await this.aesirx.create(Entity.Tag, resource)

				this.logger.info('Saved Tags with remote id ' + remoteId)
				this.logger.debug('resource', resource)
			}
		)
	}

	public async runAll(): Promise<void> {
		await this.runCategories()
		await this.runTags()
		await this.runPosts()
		await this.runPages()
	}
}
