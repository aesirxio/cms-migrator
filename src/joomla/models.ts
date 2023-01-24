export interface Tag {
	type: string
	id: string
	attributes: {
		title: string,
		description: string,
		parent_id: number,
	}
}

export interface Content {
	type: string
	id: string
	attributes: {
		title: string,
		text: string,
		tags: {
			[key in number | string]: string
		}
	}
	relationships: {
		category: {
			data: {
				type: string,
				id: string
			}
		}
		created_by: {}
	}
}

export interface Category {
	type: string
	id: string
	attributes: {
		title: string
		parent_id: number
		text: string
		alias: string
	}
}

export interface JoomlaData<T> {
	links: {
		self: string
		next?: string
	}
	data: Array<T>
	meta: {
		'total-pages': number
	}
}

export interface JoomlaDatum<T> {
	links: {
		self: string
	}
	data: T
}