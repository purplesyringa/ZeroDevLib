let Auth;
if(typeof ZeroAuth != "undefined") {
	// In browser
	Auth = ZeroAuth;
} else {
	// In node
	Auth = require("./ZeroAuth");
}

class RemoteZeroDB {
	constructor(page, address) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
			return;
		}
		this.page = page;
		this.address = address;
		this.auth = new Auth(page);
	}

	query(query, placeholders) {
		return this.page.cmd("as", [this.address, "dbQuery", [query, placeholders]])
			.then(result => {
				if(result.error) {
					return Promise.reject(result.error);
				}

				return result;
			});
	}

	getPrivateKey(contentFile) {
		let auth = this.auth.getAuth();
		return this.page.cmd("fileRules", ["cors-" + this.address + "/" + contentFile])
			.then(rules => {
				if(auth && rules.signers.indexOf(auth.address) > -1) {
					return null;
				}

				return "stored";
			});
	}

	insertRow(dataFile, contentFile, table, row, autoIncrement, privatekey) {
		return Promise.reject("Remote DB cannot be changed");
	}
	changeRow(dataFile, contentFile, table, f, privatekey) {
		return Promise.reject("Remote DB cannot be changed");
	}
	removeRow(dataFile, contentFile, table, f, privatekey) {
		return Promise.reject("Remote DB cannot be changed");
	}

	changePair(dataFile, contentFile, table, key, value, privatekey) {
		return Promise.reject("Remote DB cannot be changed");
	}

	getJsonID(path, version) {
		let where;
		if(version == 1) {
			where = {
				path: path
			};
		} else if(version == 2) {
			path = path.split("/");
			where = {
				directory: path.slice(0, -1).join("/"),
				file_name: path.slice(-1)[0]
			};
		} else if(version == 3) {
			path = path.split("/");
			where = {
				site: path[0],
				directory: path.slice(1, -1).join("/"),
				file_name: path.slice(-1)[0]
			};
		}

		return this.query("SELECT * FROM json WHERE ?", where)
			.then(json => {
				return json.length ? json[0].json_id : -1;
			});
	}
};

if(typeof module != "undefined" && typeof module.exports != "undefined") {
	module.exports = RemoteZeroDB;
}