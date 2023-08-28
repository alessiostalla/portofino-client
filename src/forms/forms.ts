import {
    getValidators, NUMBER_TYPE,
    ObjectAccessor,
    ObjectAdapter,
    Property,
    STRING_TYPE,
    TypeConverter,
    Validator
} from "../objectAccessor";

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
                element = this.addField(p);
            }
            if (element instanceof HTMLInputElement) {
                const validators = getValidators(p);
                if (validators) {
                    this.setupValidators(p, element, validators);
                }
            }
        });
    }

    protected addField(p: Property): Element | undefined {
        if (p.selectionProvider) {
            throw `Add missing field ${p.name} with selection provider not supported`;
        }
        if (p.type == STRING_TYPE || p.portofinoType == NUMBER_TYPE) {
            const id = (this.object.id || "") + "-" + p.name;
            const container = new HTMLSpanElement();
            const label = new HTMLLabelElement();
            label.textContent = p.label;
            label.htmlFor = id;
            const input = new HTMLInputElement();
            input.id = id;
            container.appendChild(label);
            container.appendChild(input);
            this.object.appendChild(container);
            return input;
        } else {
            throw `Add missing field ${p.name} of type ${p.type} (${p.portofinoType}) not supported`;
        }
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
