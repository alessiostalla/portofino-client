import {
    BOOLEAN_TYPE,
    getValidators,
    NUMBER_TYPE,
    ObjectAccessor,
    ObjectAdapter,
    Property,
    STRING_TYPE,
    TypeConverter,
    Validator
} from "../objectAccessor";
import {ResourceAction} from "../portofino";
import {from, map, mergeMap, Observable, ReplaySubject, throwError} from "rxjs";

export enum Mode {
    READ,
    CREATE,
    EDIT
}

export type FormSetupOptions = {
    addMissingFields: boolean;
    mode: Mode
}

const DEFAULT_FORM_SETUP_OPTIONS: FormSetupOptions = {
    addMissingFields: true, mode: Mode.EDIT
}

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

    setup(accessor: ObjectAccessor, options = DEFAULT_FORM_SETUP_OPTIONS) {
        accessor.properties
            .filter(p => this.isEnabled(p, options.mode))
            .forEach(p => {
            let element = this.getFormElement(p);
            if (!element && options.addMissingFields) {
                element = this.addField(p);
            }
            if (element instanceof HTMLInputElement) {
                const validators = getValidators(p);
                if (validators) {
                    this.setupValidation(p, element, validators);
                }
            }
        });
    }

    fromResource(
        resource: ResourceAction, options?: FormSetupOptions,
        operation = "describeClassAccessor"
    ): Observable<ObjectAccessor> {
        const obs: Observable<ObjectAccessor> = resource.operations.pipe(mergeMap(ops => {
            if (!ops[operation]) {
                return throwError(() =>
                    new Error(`The resource ${resource} doesn't support an operation named ${operation}`));
            }
            return ops[operation].invoke().pipe(
                mergeMap(resp => from(resp.json())),
                map((acc: any) => {
                    const accessor = ObjectAccessor.create(acc);
                    this.setup(accessor, options || DEFAULT_FORM_SETUP_OPTIONS);
                    return accessor;
                }));
        }));
        const subject = new ReplaySubject<ObjectAccessor>(1);
        obs.subscribe(subject);
        return subject;
    }

    protected addField(p: Property): Element | undefined {
        if (p.selectionProvider) {
            throw `Add missing field ${p.name} with selection provider not supported`;
        }
        if (p.type == STRING_TYPE) {
            return this.addTextField(p);
        } else if (p.type == NUMBER_TYPE) {
            return this.addTextField(p);
        } else if (p.type == BOOLEAN_TYPE) {
            return this.addBooleanField(p);
        } else {
            throw `Add missing field ${p.name} of type ${p.type} (${p.portofinoType}) not supported`;
        }
    }

    protected addTextField(property: Property) {
        const id = this.getFieldId(property);
        const input = document.createElement("input");
        input.id = id;
        input.name = this.nameMapper(property.name);
        const container = this.createFieldContainer(property, input);
        this.object.appendChild(container);
        return input;
    }

    protected addBooleanField(property: Property) {
        const id = this.getFieldId(property);
        const checkbox = document.createElement("input");
        checkbox.id = id;
        checkbox.type = "checkbox";
        checkbox.name = this.nameMapper(property.name);
        const container = this.createFieldContainer(property, checkbox);
        this.object.appendChild(container);
        return checkbox;
    }

    protected createFieldContainer(property: Property, input: HTMLElement) {
        const container = document.createElement("span");
        container.className = "portofino-form-field";
        const label = document.createElement("label");
        label.textContent = property.label + " ";
        label.htmlFor = input.id;
        container.appendChild(label);
        container.appendChild(input);
        return container;
    }

    private getFieldId(property: Property) {
        const formId = this.object.getAttribute("id");
        const id = (formId ? (formId + "-") : "") + property.name;
        return id;
    }

    protected setupValidation(property: Property, element: HTMLInputElement, validators: Validator[]) {
        this.validate(property, element, validators);
        const listener = element.onchange;
        element.onchange = (ev: Event) => {
            this.validate(property, element, validators);
            if (listener) {
                return listener.call(element, ev);
            }
        };
    }

    protected validate(property: Property, element: HTMLInputElement, validators: Validator[]) {
        element.dataset["validationErrors"] = "";
        validators.forEach(validator => {
            const error = validator.validationError(this.get(property));
            if (error) {
                if (element.dataset["validationErrors"]) {
                    element.dataset["validationErrors"] += "," + error;
                } else {
                    element.dataset["validationErrors"] = error;
                }
            }
        });
    }

    protected getFormElement(property: Property) {
        return this.object.querySelector(`[name=${this.nameMapper(property.name)}]`);
    }

    isEnabled(property: Property, mode: Mode) {
        return true; // TODO
    }
}
