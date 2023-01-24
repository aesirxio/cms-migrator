import {RestClient} from "typed-rest-client/RestClient";
import {IRestResponse} from "typed-rest-client";
import {
	AesirxAddTagResource,
	AesirxList,
	AesirxListEntity,
	AesirxResource,
	AesirxResponseCreate,
	AesirxResponseUpdate
} from "./models";
import {Logger} from "tslog";

export enum Entity {
	Category,
	Tag,
	Item,
}

type Ref = {
	[key in Entity]: {
		[key: string | number]: string | number
	}
};

type UrlPart = {
	[key in Entity]: string
}

export class AesirX {
	client: RestClient
	private ref: Ref
	private apiDomain: string
	private relatedAesirxUrl = '/index.php?option=reditem&webserviceClient=site&webserviceVersion=1.0.0&api=hal'
	private entityUrlPart: UrlPart = {
		[Entity.Category]: '&view=category_with_org_check_aesirx_categories_69',
		[Entity.Tag]: '&view=category_with_org_check_aesirx_tags_70',
		[Entity.Item]: '&view=item_with_org_check_aesirx_content_68',
	}
	private remotePrefix: string;
	private logger: Logger<any>;

	constructor(client: RestClient, apiDomain: string, remotePrefix: string) {
		this.client = client
		this.ref = {
			[Entity.Category]: {},
			[Entity.Tag]: {},
			[Entity.Item]: {}
		}
		this.apiDomain = apiDomain
		this.remotePrefix = remotePrefix
		this.logger = new Logger({ type: "hidden" });
	}

	public addLogger(logger: Logger<any>):this {
		this.logger = logger
		return this
	}

	public setRemoteEntityId(localId: string | number, entityName: Entity, remoteKey: string | number): void {
		this.ref[entityName][localId] = remoteKey
	}

	public async addTag(resource: AesirxAddTagResource): Promise<void> {
		const restTo: IRestResponse<AesirxResponseCreate> = await this.client.create(
			this.apiDomain
			+ this.relatedAesirxUrl
			+ this.entityUrlPart[Entity.Item]
			+ '&task=addTag',
			resource,
			{
				acceptHeader: "*/*",
			}
		)

		if (restTo.statusCode != 200 || !restTo.result) {
			throw new Error('Entity was not created')
		}

		this.logger.info('Added tag')
		this.logger.debug( resource)
	}

	public async create(entityName: Entity, resource: AesirxResource): Promise<number | string> {
		try {
			resource.id = await this.getRemoteEntityId(resource.remote_key, entityName)
		} catch (err) {
		}

		let use: AesirxResource = { ...resource }
		use.remote_key = this.remotePrefix + '|' + use.remote_key

		// Update
		if (resource.id) {
			const restTo: IRestResponse<AesirxResponseUpdate> = await this.client.replace(
				this.apiDomain
				+ this.relatedAesirxUrl
				+ this.entityUrlPart[entityName],
				use,
				{
					acceptHeader: "*/*",
				}
			)
			if (restTo.statusCode != 200 || !restTo.result) {
				throw new Error('Entity was not created')
			}

			this.logger.info('Updated entity ' + entityName + ' with id ' + resource.id)
			this.logger.debug(use)

			this.ref[entityName][resource.remote_key] = resource.id
		}

		// Create
		else {
			const restTo: IRestResponse<AesirxResponseCreate> = await this.client.create(
				this.apiDomain
				+ this.relatedAesirxUrl
				+ this.entityUrlPart[entityName],
				use,
				{
					acceptHeader: "*/*",
				}
			)
			if (restTo.statusCode != 201 || !restTo.result) {
				throw new Error('Entity was not created')
			}

			this.logger.info('Created remote entity ' + entityName + ' with id ' + restTo.result.id)
			this.logger.debug(use)

			this.ref[entityName][resource.remote_key] = restTo.result.id
		}

		return this.ref[entityName][resource.remote_key]
	}

	public async getRemoteEntityId(localId: string | number, entityName: Entity): Promise<number | string> {
		if (!(localId in this.ref[entityName])) {
			const restRes: IRestResponse<AesirxList<AesirxListEntity>> = await this.client.get(
				this.apiDomain
				+ this.relatedAesirxUrl
				+ this.entityUrlPart[entityName]
				+ '&filter[remote_key]=' + this.remotePrefix + '|' + localId,
				{
					acceptHeader: "*/*",
					additionalHeaders: {
						"Content-Type": 'application/json; charset=utf-8'
					}
				}
			);

			if (restRes.statusCode != 200 || !restRes.result) {
				throw new Error('Data not found')
			}
			this.setRemoteEntityId(localId, entityName, restRes.result._embedded.item[0].id)
			this.logger.info('Found remotely entity ' + entityName + ' with id ' + localId)
			this.logger.debug( restRes.result._embedded.item[0])
		}

		return this.ref[entityName][localId]
	}
}