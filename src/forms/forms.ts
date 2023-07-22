import {ObjectAdapter, Property, TypeConverter} from "../objectAccessor";

export class FormAdapter extends ObjectAdapter<HTMLFormElement> {
    constructor(
        protected nameMapper: (n: string) => string = n => n,
        converter: TypeConverter = new TypeConverter()) {
        super(converter);
    }

    // TODO setup method to create/integrate form for accessor

    rawGet(obj: HTMLFormElement, property: Property): any {
        const element = this.getFormElement(obj, property);
        if (element instanceof HTMLInputElement) {
            return element.value;
        }
    }

    rawSet(obj: HTMLFormElement, property: Property, value: any) {
        const element = this.getFormElement(obj, property);
        if (element instanceof HTMLInputElement) {
            element.value = value?.toString();
        }
    }

    protected getFormElement(obj: HTMLFormElement, property: Property) {
        return obj.querySelector(`[name=${this.nameMapper(property.name)}]`);
    }
}
