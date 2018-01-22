let FS, Optional;
if(typeof ZeroFS != "undefined") {
	// In browser
	FS = ZeroFS;
} else {
	// In node
	FS = require("./ZeroFS");
}
if(typeof ZeroOptional != "undefined") {
	// In browser
	Optional = ZeroOptional;
} else {
	// In node
	Optional = require("./ZeroOptional");
}

class ZeroOptionalProxy {
	constructor(page) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;

		this.fs = new FS(page);
		this.optional = new Optional(page);
	}

	fileExists(file) {
		return this.fs.fileExists(file)
			.then(exists => {
				if(exists) {
					return exists;
				}

				return this.optional.fileExists(file);
			});
	}
	readFile(file) {
		return this.fs.readFile(file)
			.catch(() => this.optional.readFile(file));
	}
	writeFile(file, content) {
		return this.fs.writeFile(file, content)
			.catch(() => this.optional.writeFile(file, content));
	}
	deleteFile(file) {
		return this.optional.deleteFile(file)
			.catch(() => {})
			.then(() => this.fs.deleteFile(file))
			.catch(() => {});
	}

	readDirectory(dir, recursive) {
		let fs, optional, err;

		return this.fs.readDirectory(dir, recursive)
			.then(content => fs = content)
			.catch(e => { fs = []; err = e })
			.then(() => this.optional.readDirectory(dir, recursive))
			.then(content => optional = content)
			.catch(e => {
				optional = [];

				if(err) {
					return Promise.reject(err);
				}
			})
			.then(() => {
				return [].concat(fs, optional)
					.filter((obj, i, arr) => arr.indexOf(obj) == i);
			});
	}

	getType(file) {
		return this.fs.getType(file)
			.catch(() => this.optional.getType(file));
	}
	isOptional(file) {
		return this.optional.isOptional(file);
	}
	isDownloaded(file) {
		return this.optional.isDownloaded(file);
	}
};

if(typeof module != "undefined" && typeof module.exports != "undefined") {
	module.exports = ZeroOptionalProxy;
}