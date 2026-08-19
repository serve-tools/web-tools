import { AsyncOperationSubscriber, observeOperationView } from "../src/lit-signals.js";

const subscriber = new AsyncOperationSubscriber<string, number>();
const lengthView = subscriber.map((value) => value.length);
const optionalLength = observeOperationView(lengthView);
const lengthOrUndefined: number | undefined = optionalLength.get();
const lengthWithLabel = observeOperationView(lengthView, "Waiting");
const lengthOrLabel: number | string = lengthWithLabel.get();

// @ts-expect-error The initial string remains part of the Signal value type.
const length: number = lengthWithLabel.get();

void [subscriber, optionalLength, lengthOrUndefined, lengthWithLabel, lengthOrLabel, length];
