declare function acquireVsCodeApi(): any;

class VSCodeAPIWrapper {
    private readonly vsCodeApi: any;

    constructor() {
        if (typeof acquireVsCodeApi === 'function') {
            this.vsCodeApi = acquireVsCodeApi();
        } else {
            this.vsCodeApi = null;
        }
    }

    public postMessage(message: any) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        } else {
            console.log('Mock postMessage:', message);
        }
    }
}

export const vscode = new VSCodeAPIWrapper();
