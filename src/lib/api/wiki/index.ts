import debug from 'debug';
import { Request, Response, Router } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import marked from 'marked';
import { parse } from 'node-html-parser';
import YAML from 'yaml';
import fs from 'fs';

// Initialize a logger instance.
const logger: debug.Debugger = debug('src/blockchain/eth/transactions/index.ts');

// Initialize router.
const wikiRouter = Router();

// Assign request handlers.
wikiRouter.get('/wikiparse*', async (request: Request, response: Response) => {
	console.log('got request');
    let url = request.params[0];
	if (url.includes(".")) {
		response.send(false);
		return false;
	}
	try {
		const data = await fs.promises.readFile(process.env.WIKI_DIR + url + ".md", "utf8");
		console.log('data', data); 
		let md = data;
		const regex = /^-{3}([\S]+)?\n([\s\S]+)\n-{3}/;
		const metaData = md.match(regex)[0].replace("---\n", "").replace("---", "");
		const obj = YAML.parse(metaData);
		if (!obj.title) {
			response.send(false);
			return false;
		}
		obj.path = url;
		md = md.replace(regex, "");
		let html = marked(md);
		const root = parse(html);
		if (!request.query.section) {
			obj.html = html;
			response.json(obj);
			return;
		}
		let newHtml = "";
		let headerStarted = false;
		for (let i = 0; i < root.childNodes.length; i++) {
			const node : any= root.childNodes[i];

			if (node.rawTagName === "h2") {
				if (headerStarted) break;
				let id = node.childNodes[0].rawText.match(/{#(.*)}/);
				let sectionId = id ? id[1] : node.id;
				if (sectionId === request.query.section) {
					headerStarted = true;
					obj.section = id ? node.childNodes[0].rawText.replace(/{#(.*)}/, "") : node.childNodes[0].rawText;
				}
				continue;
			}
			if (node.parentNode.parentNode === null && headerStarted) {
				newHtml = newHtml + node.toString();
			}
		}
		obj.html = newHtml;
		response.send(obj);
		return;
	} catch (err) {
		console.error(err);
		logger(err);
		response.send(false);
		return false;
	}


    return response.status(StatusCodes.NOT_IMPLEMENTED)
        .send({ error: getReasonPhrase(StatusCodes.NOT_IMPLEMENTED )});
});

export default wikiRouter;