/* Use json files as plain objects
 * Usage example:
 (async () => {
     var zeroframe = new ZeroFrame()
     var zeropage = new ZeroPage(zeroframe)
     var zerofs = new ZeroFS(zeropage)
     var storage = FileBackedStorage(zerofs, "data/users/" + zeroframe.site_info.auth_address + "/data.json")
     if (await storage.$exists())
         await storage.$load()
     storage["a"] = 3
     await storage.$save$sign$publish() 
     // Or the equivalent
     // await storage.$save()
     // await storage.$sign()
     // await storage.$publish()
     storage["a"] = 5
     await storage.$load()
     // Now storage["a"] == 3.
 })()
 */

const FileBackedStorage = (zerofs, filename) => {
	var handler = {
	get: (inner, key) => {
		// If key is without $ we return its property
		let expanded = key.split("$")
		if (expanded.length == 1)
		return inner[key]
		else {
		return () => {
			// Otherwise we return a promise for the action
			let promise = new Promise(res => res())
			for (let method of expanded) {
			switch (method) {
			case "":
				break
			case "delete":
				promise = promise.then(() => zerofs.deleteFile(filename))
				break
			case "exists":
				promise = promise.then(() => zerofs.fileExists(filename))
				break
			case "load":
				promise = promise
				.then(() => zerofs.readFile(filename))
				.then(content => inner = JSON.parse(content))
				break
			case "save":
				promise = promise.then(() => zerofs.writeFile(filename, JSON.stringify(inner, null, 1)))
				break
			case "sign":
				promise = promise.then(() => zerofs.page.sign(filename))
				break
			case "publish":
				promise = promise.then(() => zerofs.page.publish(filename))
				break
			default:
				throw "Unknown method " + method
			}
			}
			return promise
		}
		}
	},
	set: (inner, key, value) => {
		let expanded = key.split("$")
		if (expanded.length == 1)
		return inner[key] = value
		else
		throw key + " is not settable!"
	}
	}
	return new Proxy({}, handler)
}

const FolderBackedStorage = (zerofs, folderpath) => {
	var handler = {
	get: (inner, key) => {
		if (inner[key] == undefined)
		inner[key] = FileBackedStorage(folderpath + "/" + key + ".json")
		return inner[key]
	}
	}
	return new Proxy({}, handler)
}
