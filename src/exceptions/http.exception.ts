export class HttpException extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpException";
  }
}

/** @deprecated Use HttpException — kept so call sites can stay short. */
export class HttpError extends HttpException {}
