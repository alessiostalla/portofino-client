export const BOOLEAN_TYPE = "boolean";
export const DATE_TYPE = "date";
export const NUMBER_TYPE = "number";
export const STRING_TYPE = "string";

export class ObjectAccessor {
  name: string;
  properties: Property[] = [];
  keyProperties: string[] = [];

  initSelectionProviders() {
    this.properties.forEach(p => {
      const select = getAnnotation(p, "com.manydesigns.elements.annotations.Select");
      if (select) {
        p.selectionProvider = Object.assign(new SelectionProvider(), {displayMode: select.properties.displayMode});
        for (const i in select.properties.values) {
          p.selectionProvider.options.push({v: select.properties.values[i], l: select.properties.labels[i], s: false});
        }
      }
    });
  }

  static getProperty(self: ObjectAccessor, name: string) {
    for(const p in self.properties) {
      const property = self.properties[p];
      if(property.name == name) {
        return property
      }
    }
  }

  static create(values: ObjectAccessor | any): ObjectAccessor | undefined {
    const ca = Object.assign(new ObjectAccessor(), values);
    ca.properties = [];
    for (const propDef of values.properties) {
      ca.properties.push(Property.create(propDef));
    }
    ca.initSelectionProviders();
    return ca;
  }

  static forObject(object: any, options: {
    name?: string, ownProperties?: boolean,
    properties: { [name: string]: Property | any }
  } = { properties: {} }): ObjectAccessor {
    const accessor = new ObjectAccessor();
    accessor.name = options.name;
    for(const p in object) {
      if(options.ownProperties && !Object.prototype.hasOwnProperty.call(object, p)) {
        continue;
      }
      let value = object[p];
      if(value && value.value) {
        value = value.value; //Handle objects returned by Elements that have value and displayValue
      }
      let property;
      const defaultValues: any = { name: p, label: p.charAt(0).toUpperCase() + p.slice(1) };
      if(typeof(value) === NUMBER_TYPE) {
        defaultValues.type = NUMBER_TYPE;
      }
      //We don't handle arrays and objects for now
      if(Object.prototype.hasOwnProperty.call(options.properties, p)) {
        if(options.properties[p]) {
          property = Property.create({ ...defaultValues, ...options.properties[p] });
        }
      } else {
        if(defaultValues.type || (typeof(value) == STRING_TYPE)) {
          property = Property.create(defaultValues);
        }
      }
      if(property) {
        accessor.properties.push(property);
      }
    }
    return accessor;
  }
}

export class Property {
  name: string;
  /**
   * The property's portofinoType is the native Portofino type of this property. See `type` for the JavaScript type.
   */
  portofinoType = STRING_TYPE;
  annotations: Annotation[] = [];
  modifiers: string[] = [];
  label: string;
  key: boolean;
  get type() {
    return deriveType(this);
  }

  editable: boolean;
  selectionProvider: SelectionProvider;

  static create(values: Property | any): Property {
    const definition = {...values};
    delete definition.type;
    return Object.assign(new Property(), definition);
  }

  static get(owner: ObjectAccessor, name: string) {
    return ObjectAccessor.getProperty(owner, name);
  }

  required(value = true): Property {
    return this.withAnnotation(ANNOTATION_REQUIRED, { value: value });
  }

  withAnnotation(type: string, properties: any = {}) {
    const annotation = getAnnotation(this, type);
    if(annotation) {
      annotation.properties = properties;
    } else {
      this.annotations.push(new Annotation(type, properties));
    }
    return this;
  }

  withSelectionProvider(sp: SelectionProvider | any) {
    this.selectionProvider = Object.assign(new SelectionProvider(), sp);
    return this;
  }
}

export class Annotation {
  type: string;
  properties: any;

  constructor(type?: string, properties?: any) {
    this.type = type;
    this.properties = properties;
  }
}

export class SelectionProvider {
  name?: string;
  index = 0;
  displayMode = "DROPDOWN";
  url?: string;
  nextProperty?: string;
  // updateDependentOptions: () => void = () => {};
  // loadOptions: (value?: string) => void = () => {};
  options: SelectionOption[] = [];
}

export class SelectionOption {
  v: string;
  l: string;
  s: boolean;
}

export const ANNOTATION_REQUIRED = "com.manydesigns.elements.annotations.Required";

export function getAnnotation(property: Property, type: string): Annotation {
  return property.annotations.find(value => value.type == type);
}

export function isBooleanProperty(property: Property) {
  return property.portofinoType == 'java.lang.Boolean' || property.portofinoType == BOOLEAN_TYPE
}

export function isStringProperty(property: Property) {
  return property.portofinoType == 'java.lang.String' || property.portofinoType == STRING_TYPE
}

export function isNumericProperty(property: Property) {
  return property.portofinoType == 'java.lang.Long' || property.portofinoType == 'java.lang.Integer' ||
         property.portofinoType == 'java.lang.Float' || property.portofinoType == 'java.lang.Double' ||
         property.portofinoType == 'java.math.BigInteger' || property.portofinoType == 'java.math.BigDecimal' ||
         property.portofinoType == NUMBER_TYPE
}

export function isDateProperty(property: Property) {
  return property.portofinoType == 'java.util.Date' ||
         property.portofinoType == 'java.sql.Date' || property.portofinoType == 'java.sql.Timestamp' ||
         property.portofinoType == DATE_TYPE;
}

export function isEnabled(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Enabled");
  //By default, properties are enabled
  return !annotation || annotation.properties.value;
}

export function isUpdatable(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Updatable");
  return annotation && annotation.properties.value;
}

export function isInsertable(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Insertable");
  return annotation && annotation.properties.value;
}

export function isSearchable(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Searchable");
  return annotation && annotation.properties.value;
}

export function isInSummary(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.InSummary");
  return annotation && annotation.properties.value;
}

export function isRequired(property: Property) {
  const annotation = getAnnotation(property, ANNOTATION_REQUIRED);
  return annotation && annotation.properties.value;
}

export function isMultiline(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Multiline");
  return annotation && annotation.properties.value;
}

export function isPassword(property: Property) {
  const annotation = getAnnotation(property, "com.manydesigns.elements.annotations.Password");
  return !!annotation;
}

export const RICH_TEXT_ANNOTATION = "com.manydesigns.elements.annotations.RichText";

export function isRichText(property: Property) {
  const annotation = getAnnotation(property, RICH_TEXT_ANNOTATION);
  return annotation && annotation.properties.value;
}

export function isBlob(property: Property) {
  return getAnnotation(property, "com.manydesigns.elements.annotations.FileBlob") ||
         getAnnotation(property, "com.manydesigns.elements.annotations.DatabaseBlob");
}

export function deriveType(property: Property) {
  if(isBlob(property)) {
    return "blob";
  }
  if(isNumericProperty(property)) {
    return NUMBER_TYPE;
  }
  if(isDateProperty(property)) {
    return DATE_TYPE;
  }
  if(isStringProperty(property)) {
    return STRING_TYPE;
  }
  if(isBooleanProperty(property)) {
    return BOOLEAN_TYPE;
  }
  throw `${property.name}: unsupported property type ${property.portofinoType}`
}

export interface Validator {
  validationError(value?: any): string | undefined;
}

export const VALIDATION_ERROR_REQUIRED = "portofino.forms.validation.required";
export const VALIDATION_ERROR_TOO_LONG = "portofino.forms.validation.tooLong";
export const VALIDATION_ERROR_TOO_BIG = "portofino.forms.validation.tooBig";
export const VALIDATION_ERROR_TOO_SMALL = "portofino.forms.validation.tooSmall";

export function getValidators(property: Property): Validator[] {
  const validators: Validator[] = [];
  //Required on checkboxes means that they must be checked, which is not what we want
  if (isRequired(property) && property.type != BOOLEAN_TYPE) {
    validators.push({
      validationError(value?) {
        if (value === undefined || value === null || value === "") {
          return VALIDATION_ERROR_REQUIRED;
        }
      }
    });
  }
  const maxLength = getAnnotation(property, "com.manydesigns.elements.annotations.MaxLength");
  if (maxLength) {
    validators.push({
      validationError(value?) {
        if(typeof(value) === "string" && value.length > maxLength.properties.value) {
          return VALIDATION_ERROR_TOO_LONG;
        }
      }
    });
  }
  const maxValue =
    getAnnotation(property, "com.manydesigns.elements.annotations.MaxDecimalValue") ||
    getAnnotation(property, "com.manydesigns.elements.annotations.MaxIntValue");
  if (maxValue) {
    validators.push({
      validationError(value?) {
        if(typeof(value) === "number" && value > maxValue.properties.value) {
          return VALIDATION_ERROR_TOO_BIG;
        }
      }
    });
  }
  const minValue =
    getAnnotation(property, "com.manydesigns.elements.annotations.MinDecimalValue") ||
    getAnnotation(property, "com.manydesigns.elements.annotations.MinIntValue");
  if (minValue) {
    validators.push({
      validationError(value?) {
        if(typeof(value) === "number" && value < minValue.properties.value) {
          return VALIDATION_ERROR_TOO_SMALL;
        }
      }
    });
  }
  return validators;
}

export abstract class ObjectAdapter<T> {
  constructor(protected object: T, protected converter: TypeConverter = new TypeConverter()) {}

  get(property: Property): any | undefined {
    return this.convert(this.rawGet(property), property);
  }
  set(property: Property, value?: any) {
    this.rawSet(property, this.convert(value, property));
  }

  protected abstract rawGet(property: Property): any | undefined;
  protected abstract rawSet(property: Property, value?: any);

  protected convert(value: any, property: Property): any {
    return this.converter.convert(value, typeof value, property.type)
  }

  static copy(accessor: ObjectAccessor, source: ObjectAdapter<any>, target: ObjectAdapter<any>) {
    accessor.properties.forEach(p => {
      target.set(source.get(p));
    });
  }
}

export class ConversionError extends Error {
  constructor(public readonly value: any, public readonly fromType: string, public readonly toType: string) {
    super(`Cannot convert ${value} from ${fromType} to ${toType}`);
  }
}

export class TypeConverter {
  protected converters: Map<string, (x: any) => any> = new Map<string, (x: any) => any>();

  constructor() {
    this.converters.set("string->number", (x: string) => {
      const number = parseFloat(x);
      if (isNaN(number)) {
        throw new ConversionError(x, "string", "number");
      } else {
        return number;
      }
    });
    this.converters.set("number->string", (x: number) => {
      return "" + x;
    });
  }

  convert(value: any, from: string, to: string): any | undefined {
    if (value === undefined) {
      return undefined;
    }
    const key = `${from}->${to}`;
    const fn = this.converters.get(key) || (x => x);
    return fn(value);
  }
}

export class JSONAdapter extends ObjectAdapter<any> {

  rawGet(property: Property): any {
    return this.object[property.name];
  }

  rawSet(property: Property, value?: any) {
    this.object[property.name] = value;
  }
}
