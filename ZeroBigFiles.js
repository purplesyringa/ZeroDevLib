let Optional;
if(typeof ZeroOptional != "undefined") {
	// In browser
	Optional = ZeroOptional;
} else {
	// In node
	Optional = require("./ZeroOptional");
}

class ZeroBigFiles extends Optional {
	constructor(page) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;
	}

	uploadFile(path, /* File */ file, /* optional */ progressCallback) {
		return this.page.cmd("BigfileUploadInit", {
			inner_path: path, // Upload location
			size: file.size
		})
			.then(endpoint => {
				return new Promise((resolve, reject) => {
					let formdata = new FormData();
					formdata.append(file.name, file);

					let req = new XMLHttpRequest();
					if(progressCallback) {
						req.upload.addEventListener("progress", e => {
							console.log(e);
							progressCallback(e);
						});
					}
					req.upload.addEventListener("loadend", () => {
						resolve(endpoint.inner_path);
					});
					req.withCredentials = true;
					req.open("POST", endpoint.url);
					req.send(formdata);
				});
			});
	}
};

if(typeof module != "undefined" && typeof module.exports != "undefined") {
	module.exports = ZeroBigFiles;
}