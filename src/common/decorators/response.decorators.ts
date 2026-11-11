import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE = 'response:message';
export const RAW_RESPONSE = 'response:raw';

/** The `message` of the success envelope: @ResponseMessage('Products retrieved'). */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE, message);

/** Skip the envelope: the handler returns the final body itself (health, root). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
