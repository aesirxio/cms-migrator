import {IRequestOptions, IRestResponse, RestClient} from "typed-rest-client";
import {IRequestQueryParams} from "typed-rest-client/Interfaces";
import {Category, Content, JoomlaData, JoomlaDatum, Tag} from "./models";
import {CategoryResource, ItemResource, TagResource} from "../aesirx/models";
import {AesirX, Entity} from "../aesirx/script";
import {Logger} from "tslog";

export class Joomla {
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
		let offset: number = 0

		while (true) {
			const options: IRequestOptions = {
				acceptHeader: "*/*",
				additionalHeaders: {
					"Content-Type": 'application/json; charset=utf-8'
				},
				queryParameters: <IRequestQueryParams><unknown>{
					params: {
						...{
							page: {
								limit: this.limit,
								offset: offset,
							},
							list: {
								ordering: 'id',
								direction: 'asc'
							}
						},
						...params
					}
				}
			}

			const restRes: IRestResponse<JoomlaData<T>> = await this.from.get(url, options);

			if (restRes.statusCode != 200 || !restRes.result) {
				throw new Error('Data not found')
			}

			this.logger.info('Selected list of entities from URL ' + url)
			this.logger.debug('params', options.queryParameters)

			// Probably less heavier for frontend executions
			// https://gist.github.com/joeytwiddle/37d2085425c049629b80956d3c618971#process-each-player-in-serial-using-arrayprototypereduce
			await restRes.result.data.reduce(async (prev, item) => {
				// Wait for the previous item to finish processing
				await prev
				// Process this item
				await done(item)
			}, Promise.resolve())

			offset += this.limit;

			if (restRes.result.links.next === undefined) {
				break
			}
		}
	}

	public async runCategories(): Promise<void> {
		await this.run<Category>(
			'/api/index.php/v1/content/categories',
			{
				list: {
					ordering: 'a.lft', direction: 'asc'
				}
			},
			async (item) => {
				const resource: CategoryResource = {
					title: item.attributes.title,
					remote_key: item.id,
				};

				if (item.attributes.parent_id != 1) {
					resource.parent_id = await this.aesirx.getRemoteEntityId(item.attributes.parent_id, Entity.Category)
				}

				const remoteId = await this.aesirx.create(Entity.Category, resource)

				this.logger.info('Saved Category with remote id ' + remoteId)
				this.logger.debug('resource', resource)
			}
		)
	}

	public async runContents(): Promise<void> {
		const options: IRequestOptions = {
			acceptHeader: "*/*"
		};

		await this.run<Content>(
			'/api/index.php/v1/content/articles',
			{
				list: {
					ordering: 'a.id',
					direction: 'asc'
				}
			},
			async (item) => {

				const resource: ItemResource = {
					title: item.attributes.title,
					metaverse_content: item.attributes.text,
					remote_key: item.id,

					// Empty tags and assign again later
					aesirx_tags: [],
				};

				resource.categories = [
					await this.aesirx.getRemoteEntityId(
						item.relationships.category.data.id, Entity.Category
					)
				]

				const restRes: IRestResponse<JoomlaDatum<Content>> = await this.from.get(
					'/api/index.php/v1/content/articles/' + item.id,
					options
				);

				if (restRes.statusCode != 200 || !restRes.result) {
					throw new Error('Data not found')
				}

				const remoteId = await this.aesirx.create(Entity.Item, resource)

				this.logger.info('Saved Item with remote id ' + remoteId)
				this.logger.debug('resource', resource)

				for (const idx in restRes.result.data.attributes.tags) {
					await this.aesirx.addTag({
						content_id: remoteId,
						tag_id: await this.aesirx.getRemoteEntityId(idx, Entity.Tag),
					})
				}
			}
		)
	}

	public async runTags(): Promise<void> {
		await this.run<Tag>(
			'/api/index.php/v1/tags',
			{
				list: {
					ordering: 'a.lft',
					direction: 'asc'
				}
			},
			async (item) => {

				const resource: TagResource = {
					title: item.attributes.title,
					description: item.attributes.description,
					remote_key: item.id,
				};

				if (item.attributes.parent_id != 1) {
					resource.parent_id = await this.aesirx.getRemoteEntityId(item.attributes.parent_id, Entity.Tag)
				}

				const remoteId = await this.aesirx.create(Entity.Tag, resource)

				this.logger.info('Saved Tag with remote id ' + remoteId)
				this.logger.debug('resource', resource)
			}
		)
	}

	public async runAll(): Promise<void> {
		await this.runCategories()
		await this.runTags()
		await this.runContents()
	}
}
