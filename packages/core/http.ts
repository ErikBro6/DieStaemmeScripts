export async function gmGet(url: string, timeout = 15000): Promise<{responseText:string}> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    GM_xmlhttpRequest({ method: 'GET', url, timeout, onload: resolve, onerror: reject, ontimeout: ()=>reject(new Error('timeout')) });
  });
}
