class ZeroFS {
	constructor(page) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;
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
			file, // file
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
		return this.page.cmd("fileWrite", [
			file, // file
			this.toBase64(content, bytes), // base64-encoded content
			true // ignore bad files
		]).then(res => {
			if(res === "ok") {
				return Promise.resolve(file);
			} else {
				return Promise.reject(res);
			}
		});
	}
	deleteFile(file) {
		return this.page.cmd("fileDelete", [
			file // file
		]).then(res => {
			if(res === "ok") {
				return Promise.resolve(file);
			} else {
				return Promise.reject(res);
			}
		});
	}

	readDirectory(dir, recursive) {
		return this.page.cmd("fileList", [
			dir, // directory
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
			dir, // directory
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

	toBase64(str, bytes) {
		if(bytes == "arraybuffer") {
			let res = "";
			const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

			str = new Uint8Array(str);

			for(let i = 0; i <= str.byteLength - 3; i += 3) {
				const chunk = (str[i] << 16) | (str[i + 1] << 8) | str[i + 2];

				const a = (chunk & 16515072) >> 18;
				const b = (chunk & 258048) >> 12;
				const c = (chunk & 4032) >> 6;
				const d = chunk & 63;

				res += chars[a] + chars[b] + chars[c] + chars[d];
			}


			const additional = str.byteLength % 3;
			const mainLength = str.byteLength - str.byteLength % 3;

			if(additional == 1) {
				const chunk = str[mainLength];

				const a = (chunk & 252) >> 2;
				const b = (chunk & 3) << 4;
				res += chars[a] + chars[b] + "==";
			} else if(additional == 2) {
				const chunk = (str[mainLength] << 8) | str[mainLength + 1];

				const a = (chunk & 64512) >> 10;
				const b = (chunk & 1008) >> 4;
				const c = (chunk & 15) << 2;
				res += chars[a] + chars[b] + chars[c] + "=";
			}

			return res;
		} else {
			return btoa(bytes ? str : unescape(encodeURIComponent(str)));
		}
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
					let path = "/" + siteInfo.address + "/" + file + "?ajax_key=" + ajaxKey;

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
	module.exports = ZeroFS;
}