import {getValidators, ObjectAccessor, ObjectAdapter, Property, TypeConverter, Validator} from "../objectAccessor";

export class FormAdapter extends ObjectAdapter<HTMLFormElement> {
    constructor(
        form: HTMLFormElement,
        protected nameMapper: (n: string) => string = n => n,
        converter: TypeConverter = new TypeConverter()) {
        super(form, converter);
    }

    rawGet(property: Property): any {
        const element = this.getFormElement(property);
        if (element instanceof HTMLInputElement) {
            return element.value;
        }
    }

    rawSet(property: Property, value: any) {
        const element = this.getFormElement(property);
        if (element instanceof HTMLInputElement) {
            element.value = value?.toString();
        }
    }

    setup(accessor: ObjectAccessor, addMissingFields = true) {
        accessor.properties.forEach(p => {
            let element = this.getFormElement(p);
            if (!element && addMissingFields) {
                throw "TODO add missing element " + p.name + " not supported";
            }
            if (element instanceof HTMLInputElement) {
                const validators = getValidators(p);
                if (validators) {
                    this.setupValidators(p, element, validators);
                }
            }
        });
    }

    protected setupValidators(property: Property, element: HTMLInputElement, validators: Validator[]) {
        const listener = element.onchange;
        element.onchange = (ev: Event) => {
            element.dataset["validation-errors"] = "";
            validators.forEach(validator => {
                const error = validator.validationError(this.get(property));
                if (error) {
                    if (element.dataset["validation-errors"]) {
                        element.dataset["validation-errors"] += "," + error;
                    } else {
                        element.dataset["validation-errors"] = error;
                    }
                }
            });
            if (listener) {
                return listener.call(element, ev);
            }
        };
    }

    protected getFormElement(property: Property) {
        return this.object.querySelector(`[name=${this.nameMapper(property.name)}]`);
    }
}
