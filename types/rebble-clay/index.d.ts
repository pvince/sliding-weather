declare module '@rebble/clay' {
  class Clay {
    constructor(
      config: unknown[],
      customFunction?: (this: any, ...args: unknown[]) => void
    );
  }
  export = Clay;
}
