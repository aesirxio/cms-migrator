export interface Tag {
	id: string
	description: string
	name: string
}

export interface Post extends Page{
	categories: Array<number>
	tags: Array<number>
}

export interface Page {
	id: string
	title: {
		rendered: string
	}
	content: {
		rendered: string
	}
	excerpt: {
		rendered: string
	}
}

interface Embedded {
	embeddable: boolean,
	href: string
}

export interface Category {
	id: number
	name: string,
	parent: number,
	description: string,
	slug: string,
	_links?: {
		up: Array<Embedded>
	}
}