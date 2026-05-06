export type PropertyType = "number" | "string" | "boolean" | "color" | "enum";

export class Property<T> {
  constructor(
    public key: string,
    public type: PropertyType,
    public value: T,
    public options?: T[]
  ) {}

  parse(input: string | boolean): T {
    switch (this.type) {
      case "number":
        return Number(input) as T;
      case "boolean":
        return Boolean(input) as T;
      default:
        return input as T;
    }
  }
}
