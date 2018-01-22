let FS, WorkerOut_;
if(typeof ZeroFS != "undefined") {
	// In browser
	FS = ZeroFS;
} else {
	// In node
	FS = require("./ZeroFS");
}
if(typeof WorkerOut != "undefined") {
	// In browser
	WorkerOut_ = WorkerOut;
} else {
	// In node
	WorkerOut_ = require("workerout");
}

class ZeroID {
	constructor(page) {
		if(typeof page != "object" || !page.isZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}

		this.page = page;
		this.fs = new FS(page);

		this.cache = {};
	}

	// Reads `name` file of ZeroID and caches it
	getZeroIdFile(name, cache, property) {
		if(this.cache[cache]) {
			return Promise.resolve(this.cache[cache]);
		}

		let worker = new WorkerOut_();

		return this.fs.readFile("cors-1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz/" + name, false, true)
			.then(users => {
				return worker.JSON.parse(users);
			})
			.then(u => {
				this.cache[cache] = u[property];
				return this.cache[cache];
			});
	}

	// Returns user info by auth address
	findUserById(id) {
		return this.getZeroIdFile("data/users.json", "_cached_users_json", "users")
			.then(users => {
				let userName = Object.keys(users).find(userName => {
					return users[userName].split(",")[1] == id;
				});
				if(userName) {
					let info = users[userName].split(",");
					return {
						name: userName,
						type: info[0],
						id: info[1],
						hash: info[2]
					};
				}

				return this.getZeroIdFile("data/users_archive.json", "_cached_users_archive_json", "users")
					.then(users => {
						let userName = Object.keys(users).find(userName => {
							return users[userName].split(",")[1] == id;
						});
						if(userName) {
							let info = users[userName].split(",");
							return {
								name: userName,
								type: info[0],
								id: info[1],
								hash: info[2]
							};
						}

						let userNames = Object.keys(users).filter(userName => {
							return users[userName][0] == "@" && id.indexOf(users[userName].split(",")[1]) == 0;
						});

						if(userNames.length == 0) {
							return Promise.reject("ID " + id + " was not found");
						}

						let resolver, rejecter;
						let resulted = 0;
						let promise = new Promise((resolve, reject) => {
							resolver = resolve;
							rejecter = reject;
						});

						userNames.forEach(userName => {
							let pack = users[userName].substr(1).split(",")[0];
							this.getZeroIdFile("data/certs_" + pack + ".json", "_cached_pack_" + pack, "certs")
								.then(users => {
									let userName = Object.keys(users).find(userName => {
										return users[userName].split(",")[1] == id;
									});
									if(userName) {
										let info = users[userName].split(",");
										resolver({
											name: userName,
											type: info[0],
											id: info[1],
											hash: info[2]
										});
										return;
									}


									resulted++;
									if(resulted == userNames.length) {
										rejecter("ID " + id + " was not found");
									}
								});
						});

						return promise;
					});
			});
	}

	// Returns user info by ZeroID name
	findUserByName(userName) {
		return this.getZeroIdFile("data/users.json", "_cached_users_json", "users")
			.then(users => {
				if(users[userName]) {
					return {
						name: userName,
						type: info[0],
						id: info[1],
						hash: info[2]
					};
				}

				return this.getZeroIdFile("data/users_archive.json", "_cached_users_archive_json", "users")
					.then(users => {
						if(!users[userName]) {
							return Promise.reject("User " + userName + " was not found");
						}

						if(users[userName][0] != "@") {
							let info = users[userName].split(",");
							return {
								name: userName,
								type: info[0],
								id: info[1],
								hash: info[2]
							};
						}

						let pack = users[userName].substr(1).split(",")[0];

						return this.getZeroIdFile("data/certs_" + pack + ".json", "_cached_pack_" + pack, "certs")
							.then(users => {
								if(users[userName]) {
									let info = users[userName].split(",");
									return {
										name: userName,
										type: info[0],
										id: info[1],
										hash: info[2]
									};
								}

								return Promise.reject("User " + userName + " was not found");
							});
					});
			});
	}
};

if(typeof module != "undefined" && typeof module.exports != "undefined") {
	module.exports = ZeroID;
}