class ZeroBigFiles extends ZeroOptional {
	constructor(page) {
		if(typeof page != "object" || !page instanceof ZeroPage) {
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