export interface AesirxListEntity {
	id: string
	remote_key: string
}

export interface AesirxList<T> {
	_embedded: {
		item: Array<T>
	}
}

export interface AesirxResponseUpdate {
	"result": boolean,
	"id": number
}

export interface AesirxResponseCreate {
	"result": boolean,
	"id": number
}

export interface CategoryResource extends AesirxResource {
	title: string,
	parent_id?: string | number,
	description?: string,
}

export interface ItemResource extends AesirxResource {
	title: string
	metaverse_content?: string
	excerpt?: string
	aesirx_tags?: Array<string>
	categories?: Array<string | number>
}

export interface TagResource extends CategoryResource {
	description?: string
}

export interface AesirxResource {
	remote_key: string | number
	id?: string | number
}

export interface AesirxAddTagResource {
	content_id: string | number
	tag_id: string | number
}