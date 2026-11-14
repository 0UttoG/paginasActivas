import swaggerJsdoc from "swagger-jsdoc";

const opcions={
    definition:{
        openapi:"3.0.0",
        info:{
            title:"API REST",
            version:"1.0.0",
            description:"API REST de prueba"
        },
        servers:[
            {
                url:"http://localhost:3000"
            }
        ],
        components:{
            securitySchemes:{
                bearerAuth:{
                    type:"http",
                    scheme:"bearer",
                    bearerFormat:"JWT"
                }
            }
        },
    },
    apis:['./src/docs/*.yaml']
};
export const swaggerSpec=swaggerJsdoc(opcions);