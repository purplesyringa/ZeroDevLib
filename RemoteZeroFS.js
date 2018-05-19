class RemoteZeroFS {
	constructor(page, address) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;
		this.address = address;
	}

	fileExists(file) {
		if(file == "") { // root
			return Promise.resolve(true); // the following check will fail for root
		}

		let dirPath = file.split("/").slice(0, -1).join("/");
		let basePath = file.split("/").pop();

		return this.readDirectory(dirPath)
			.then(children => {
				return Promise.resolve(children.indexOf(basePath) > -1);
			});
	}
	readFile(file, bytes, required) {
		return this.page.cmd("fileGet", [
			"cors-" + this.address + "/" + file, // file
			required, // required (wait until file exists)
			"base64", // text or base64
			300 // timeout
		]).then(res => {
			if(res === null || res === false) {
				return Promise.reject("File doesn't exist: " + file);
			} else {
				return Promise.resolve(this.fromBase64(res, bytes));
			}
		});
	}
	writeFile(file, content, bytes) {
		return Promise.reject("Remote FS cannot be changed");
	}
	deleteFile(file) {
		return Promise.reject("Remote FS cannot be changed");
	}

	readDirectory(dir, recursive) {
		return this.page.cmd("fileList", [
			"cors-" + this.address + "/" + dir, // directory
		]).then(res => {
			if(recursive) {
				return res.sort(); // If recursive, return as given
			} else {
				return res.map(file => { // Otherwise, crop by "/" symbol
					if(file.indexOf("/") == -1) {
						return file;
					} else {
						return file.substr(0, file.indexOf("/"));
					}
				}).reduce((arr, cur) => { // And make them unique
					return arr.indexOf(cur) > -1 ? arr : arr.concat(cur);
				}, []).sort();
			}
		});
	}

	getType(file) {
		if(file == "") {
			return Promise.resolve("dir");
		}

		let dir = file.split("/");
		let relative = dir.pop();
		dir = dir.join("/");

		return this.page.cmd("fileList", [
			"cors-" + this.address + "/" + dir, // directory
		]).then(res => {
			res = res.map(file => { // Crop by "/" symbol
				if(file.indexOf("/") == -1) {
					return file;
				} else {
					return file.substr(0, file.indexOf("/")) + "/";
				}
			});

			if(res.indexOf(relative) > -1) {
				return "file";
			} else if(res.indexOf(relative + "/") > -1) {
				return "dir";
			} else {
				return Promise.reject("File doesn't exist: " + file);
			}
		});
	}

	fromBase64(str, bytes) {
		if(bytes == "arraybuffer") {
			let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

			str = str.replace(/=+$/g, "");
			let resultingSize = Math.floor(str.length / 4 * 3);

			let result = new Uint8Array(resultingSize);
			let strPos = 0;

			for(let i = 0; i < resultingSize;) {
				let part1 = chars.indexOf(str.charAt(strPos++));
				let part2 = chars.indexOf(str.charAt(strPos++));
				let part3 = chars.indexOf(str.charAt(strPos++));
				let part4 = chars.indexOf(str.charAt(strPos++));

				let res1 = (part1 << 2) | (part2 >> 4);
				let res2 = ((part2 & 15) << 4) | (part3 >> 2);
				let res3 = ((part3 & 3) << 6) | part4;

				result[i++] = res1;
				if(part3 != -1) {
					result[i++] = res2;
				}
				if(part4 != -1) {
					result[i++] = res3;
				}
			}

			return result;
		} else {
			let text = bytes ? atob(str) : decodeURIComponent(escape(atob(str)));
			return text;
		}
	}

	/* Ajax */
	peekFile(file, offset, length, bytes) {
		let siteInfo;
		return this.page.getSiteInfo()
			.then(s => {
				siteInfo = s;
				return this.page.cmd("wrapperGetAjaxKey");
			})
			.then(ajaxKey => {
				return new Promise((resolve, reject) => {
					let path = "/" + siteInfo.address + "/cors-" + this.address + "/" + file + "?ajax_key=" + ajaxKey;

					let req = new XMLHttpRequest();
					req.open("GET", path);

					if(bytes == "arraybuffer") {
						req.responseType = "arraybuffer";
					} else if(bytes) {
						req.overrideMimeType("text/plain; charset=x-user-defined");
					} else {
						req.overrideMimeType("text/plain; charset=utf-8");
					}

					req.setRequestHeader("Range", "bytes=" + offset + "-" + (offset + length - 1));

					req.onload = e => {
						if(req.status != 206) {
							reject(req.status);
						}

						if(bytes == "arraybuffer") {
							resolve(new Uint8Array(req.response));
						} else {
							resolve(req.responseText);
						}
					};
					req.onerror = e => {
						reject(e);
					};

					req.send(null);
				});
			});
	}
}

if(typeof module != "undefined" && typeof module.exports != "undefined") {
	module.exports = RemoteZeroFS;
}